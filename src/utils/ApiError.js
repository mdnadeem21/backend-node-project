class ApiError extends Error{
    constructor(
        statusCode,
        message="Something went wrong",
        errors =[],
        stack=""
    ){
        super(message)
        this.statusCode = statusCode,
        // learn about this.data from nodejs docs
        this.data = null
        this.message = message
        this.success = false 
        this.errors = errors

        if (stack) {
            this.stack = stack
        } else {
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}