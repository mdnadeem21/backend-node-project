import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () =>{

    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected !!! DB Hosted : ${connectionInstance.connection.host}`)
        
    } catch (error) {
        console.log("In DB connection Error :: ",error)
        //TODO: Learn about process in NODE
        process.exit(1)
    }
}

export default connectDB; 