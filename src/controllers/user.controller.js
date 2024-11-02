import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFileOnCloudinary } from "../utils/fileUploader.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt  from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //steps to register a user
  //1. get the data from the request body or frontned
  //2. validate the data
  //3. check if the user already exists : email, username
  //4. check for images, check for avatar
  //5. upload the images to cloudinary, avatar
  //6. create a user object in the database
  //7. remove the password and refresh token from the response
  //8. check for user created or not
  //9. return the response

  const { username, email, password, fullname } = req.body;
  console.log("Requset Body : ", req.body);
  if ([username, email, password, fullname].some((field) => field === "")) {
    throw new ApiError(400, "All fields are required");
  }
  // TODO: there is a scope of improvement in the validation of other fields

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  console.log("Avatar : ", req.files?.avatar[0]?.path);
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //   const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadFileOnCloudinary(avatarLocalPath);
  const coverImage = await uploadFileOnCloudinary(coverImageLocalPath);
  console.log("Req Files : ", req.files);
  // const coverImage = null;

  if (!avatar) {
    throw new ApiError(500, "Error while uploading images");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Error while creating user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // steps for login:
  // 1. Get data from users (username/email, password).
  // 2. Validate user data.
  // 3. Check whether user exist in DB or not.
  // 4. If the user exists, password check
  // 5. If password matched, Generate access & refresh token
  // 6. Send cookie

  const { username, email, password } = req.body;

  if (!(username || password)) {
    throw new ApiError(400, "username or password required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password does not match");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  // we have to decide that db query is expensive or not based on that we have perform next task if DB call is expensive then we should avoid it to call and update our object
  const loggedInUser = await User.findById(user._id).select(
    "-password - refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User loggedIn Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unautorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiError(401,"Invalid refresh Token")
    }
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401,"Refresh token is expired or used.")
    }
  
    const options = {
      httpOnly :true,
      secure : true
    }
  
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
  
    return res
      .status(200)
      .cookie("accessToken",accessToken,options)
      .cookie("refreshToken",refreshToken,options)
      .json(
        new ApiResponse(
          200,
          {accessToken,refreshToken},
          "Access token refreshed"
        )
      )
  } catch (error) {
    throw new ApiError(401,error?.message || "Invalid refresh token")
  }
});

const changeCurrentPassword = asyncHandler(async (req,res) => {
      const {oldPassword, newPassword} = req.body
      const user = await User.findById(req.user?._id)
      const isPasswordCorrect = await user.comparePassword(oldPassword)

      if(!isPasswordCorrect){
        throw new ApiError(400,"Old Password is not correct")
      }

      user.password  = newPassword
      await user.save({validateBeforeSave: false})
      return res
      .status(200)
      .json(new ApiResponse(200,{}, "Password chnaged successfully."))
})

const getCurrentUser = asyncHandler(async(req, res) => {
  return res
  .status(200)
  .json(200, req.user,"current user fetched successfully")
})

const updateUserAvatar = asyncHandler(async(req,res) => {

    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
      throw new ApiError(400,"Avatar file is missing")
    }
    const avatarFilePath = await uploadFileOnCloudinary(avatarLocalPath)
    if(!avatarFilePath.url){
      throw new ApiError(400,"Avatar not uploaded successfully")
    }
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set:{
          avatar : avatarFilePath.url
        }
      },
      {
        new : true
      }
    ).select("-password")

    return res
    .status(200)
    .json(
      new ApiResponse(200,user, "Avatar update")
    )
})
const updateUserCoverImage = asyncHandler(async(req,res) => {

    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
      throw new ApiError(400,"CoverImage file is missing")
    }
    const coverImageFilePath = await uploadFileOnCloudinary(coverImageLocalPath)
    if(!coverImageFilePath.url){
      throw new ApiError(400,"Cover Image not uploaded successfully")
    }
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set:{
          coverImage : coverImageFilePath.url
        }
      },
      {
        new : true
      }
    ).select("-password")

    return res
    .status(200)
    .json(
      new ApiResponse(200,user, "Cover Image update")
    )
})

const getUserChannelProfile = asyncHandler(async (req,res) => {
  const username = req.params
  if(!username?.trim()){
    throw new ApiError(400,"Username is missing");
  }

  const userChannel = await User.aggregate([
    {
      $match:{
        username : username?.toLowerCase()
      }
    },
    {
      $lookup : {
        from: "subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }
    },
    {
      $lookup : {
        from: "subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"
      }
    },
    {
      $addFields:{
        subscribersCount : {
          $size : "$subscribers"
        },
        channelSubscribedToCount : {
          $size : "$subscribedTo"
        },
        isSubscribed : {
          $cond :{
            if:{$in:[req.user?._id, "$subscribers.subscriber"]},
            then : true,
            else: false
          }
        }
      }
    },
    {
      $project:{
        fullname : 1,
        username : 1,
        subscribersCount : 1,
        channelSubscribedToCount : 1,
        isSubscribed : 1,
        avatar : 1,
        coverImage : 1,
        email : 1,
      }
    }
  ])

  if(!userChannel?.length){
    throw new ApiError(400,"Channel does not exists")
  }
  return res
  .status(200)
  .json(
    new ApiResponse(200,userChannel[0],"User channel fetched successfully")
  )

})

const getWatchHistory = asyncHandler(async(req,res) => {
    const user = await User.aggregate([
      {
        $match: new mongoose.Types.ObjectId(req.user?._id)
      },
      {
        $lookup:{
          form:"videos",
          localField:"watchHistory",
          foreignField:"_id",
          as:"watchHistory",
          pipeline: [
            {
              $lookup : {
                from: "users",
                localField:"owner",
                foreignField:"_id",
                as:"owner",
                pipeline : [
                  {
                    $project :{
                      fullname:1,
                      username:1,
                      avatar:1
                    }
                  }
                ]
              }
            },
            {
              $addFields:{
                owner:{
                  $first : "$owner"
                }
              }
            }
          ]
        }
      }
    ])

    return res
    .status(200)
    .json(
      new ApiResponse(200,user[0].watchHistory,"watched history fetched successfully")
    )
})
export { registerUser, 
        loginUser, 
        logoutUser, 
        refreshAccessToken, 
        changeCurrentPassword, 
        getCurrentUser,
        updateUserAvatar,
        updateUserCoverImage,
        getUserChannelProfile,
        getWatchHistory
      };
