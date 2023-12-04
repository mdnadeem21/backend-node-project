// require('dotenv').config({path:"./env"})
import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./env"
})
//Second Approach

connectDB()

// First Approach
// import express from "express"    
// const app = express()

// ( async () => {

//     try {
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

//         app.on("Error in DB Connection :: ",(error) => {
//             console.log("Error :: ",error)
//             throw error
//         })

//         app.listen(process.env.PORT,() =>{
//             console.log(`App is Listening on port ${process.env.PORT}`)
//         })
//     } catch (error) {
//         console.log("Error ::: ",error )
//     }
// })()