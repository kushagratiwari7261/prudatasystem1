const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, data });
};

const sendError = (res, message = 'Error', statusCode = 400) => {
    return res.status(statusCode).json({ success: false, message });
};

module.exports = { sendSuccess, sendError };
