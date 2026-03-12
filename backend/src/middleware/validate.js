const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            return next(error);
        }

        req.body = value;
        next();
    };
};

module.exports = validate;
