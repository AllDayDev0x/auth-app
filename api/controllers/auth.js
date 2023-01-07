const User = require('../models/userModel');
const jwt = require('jsonwebtoken')
const expressJWT = require('express-jwt')
const _ = require('lodash')
const { OAuth2Client } = require('google-auth-library')
const fetch = require('node-fetch')

//sendgrid
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

exports.home = (req, res) => {
    res.end('Welcome to the Authentication Application => auth controller')
}

exports.signup = (req, res) => {
    const { name, email, password } = req.body
    User.findOne({ email }).exec((err, user) => {
        if (user) {
            return res.status(400).json({
                error: 'Email is taken'
            })
        }

        const token = jwt.sign({ name, email, password }, 
            process.env.JWT_ACCOUNT_ACTIVATION, {
            expiresIn: '10m'
        })

        const emailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Account activation link',
            html: `
                <h1> Please use the following link to activate your account </h1>
                <p> ${ process.env.CLIENT_URL }/auth/activate/${ token } </p>
                <hr />
                <p> This email contain sensetive information </p>
                <p> ${ process.env.CLIENT_URL } </p>
                `
        }

        sgMail
            .send(emailData)
            .then(sent => {
                return res.json({
                    message: `Email has been sent to ${ email }. Follow the instructions to activate your account`
                })
            })
            .catch(err => {
                return res.json({
                    message: err.message
                })
            })
                
    })
}

exports.accountActivation = (req, res) => {
    const { token } = req.body
    if (token) {
        jwt.verify(token, process.env.JWT_ACCOUNT_ACTIVATION, function(err, decoded) {
            if (err) {
                console.error('JWT ERROR IN ACCOUNT ACTIVATION', err)
                return res.status(401).json({
                    error: 'Expired link. Singup again'
                })
            }

            const { name, email, password } = jwt.decode(token)

            const user = new User({ name, email, password })

            user.save((err, user) => {
                if (err) {
                    console.error('SAVE USER IN ACCOUNT ACTIVATION ERROR', err)
                    return res.ststus(401).json({
                        error: 'Error saving user in database. Try signup again'
                    })
                }

                return res.json({
                    message: 'Signup Success... Please Login'
                })
            })
        })
    } else {
        return res.json({
            message: 'Something wet wrong. Try again'
        })
    }
}

exports.signin = (req, res) => {
    const { email, password } = req.body

    //check if user exist or not
    User.findOne({ email }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'Email not exist. Try creating one...'
            })
        }

        //authenticate
        if (!user.authenicate(password)) {
            return res.status(400).json({
                error: 'Email and password do not match'
            })
        }

        //generate a token and send to client
        const token = jwt.sign({ _id: user_id }, process.env.JWT_SECRET, { expiresIn: '7d' })
        const { _id, name, email, role } = user;
        return res.json({
            token,
            user: { _id, name, email, role}
        })
    })
}

exports.requireSignin = expressJWT({
    secret: process.env.JWT_SECRET   //req.user
})


// admin middleware
exports.adminMiddleware = (req, res, next) => {
    User.findById({_id: req.user._id }).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            })
        }

        if (user.role !== 'admin') {
            return res.status(400).json({
                error: 'Access denied... User is not admin'
            })
        }

        req.profile = user;
        next()
    })
}


//forgot password
exports.forgotPassword= (req, res) => {
    const { email } = req.body

    User.findOne({ email }, (err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'Email does not exist'
            })
        }

        const token = jwt.signin({ _id: user._id }, process.env.JWT_RESET_PASSWORD, { expiresIn: '10m'})

        const emailData = {
            from: process.env.EMAIL_FROM,
            to: email,
            subject: `Password Reset Link`,
            html: `
                <h1>Please use the following link to reset your password</h1>
                <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
                <hr />
                <p>This email contain sensitive information</p>
                <p>${process.env.CLIENT_URL}</p>
            `
        }

        sgMail
            .send(emailData)
            .then(sent => {
                return res.json({
                    message: `Email has been sent to ${email}. Follow the instructions.`
                })
            })
            .catch(err => {
                return res.json({
                    message: err.message
                })
            })
    })
}

exports.resetPassword = (req, res) => {
    const { resetPasswordLink, newPassword } = req.body;

    if (resetPasswordLink) {
        jwt.verify(resetPasswordLink, process.env.JWT_RESET_PASSWORD, function(err, decoded) {
            if (err) {
                return res.status(400).json({
                    error: 'Link Expired. Try Again'
                })
            }

            User.findOne({ resetPasswordLink }, (err, user) => {
                if (err || !user) {
                    return res.status(400).json({
                        error: 'Something went wrong. Try again'
                    })
                }

                const updatedField = {
                    password: newPassword,
                    resetPasswordLink: ''
                }

                user = _.extend(user, updatedField)

                user.save(err, result) => {
                    if (err) {
                        return res.status(400).json({
                            error: 'Error resetting your password. Try again'
                        })
                    }

                    res.json({
                        message: `Password Reset Successfull.`
                    })
                }
            })
        })
    }
}

//Google login
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
exports.googleLogin = (req, res) => {
    const { idToken } = res.body

    client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID }).then(res => {
        console.log('GOOGLE LOGIN RESPONSE', res)
        const { email_verified, name, email } = res.payload

        if (email_verified) {
            User.findOne({ email }).exec((err, user) => {
                if (user) {
                    const token = jwt.signin({ _id: user._id}, process.env.JWT_SECRET, { expiresIn: '7d'})
                    const { _id, email, name, role } = user

                    return res.json({
                        token,
                        user: { _id, email, name, role}
                    })
                } else {
                    let password = email + process.env.JWT_SECRET
                    user = new User({ name, email, password })
                    user.save((err, data) => {
                        if (err) {
                            console.error('GOOGLE LOGIN ERROR ON USER SAVE COMPONENT', err)
                            return res.status(400).json({
                                error: 'User signup failed with google'
                            })
                        }

                        const token = jwt.sign({ _id: data._id }, process.env.JWT_SECRET, { expiresIn: '10m'})
                        const { _id, email, name, role } = data
                        return res.json({
                            token,
                            user: { _id, email, name, role }
                        })
                    })
                }
            })
        } else {
            return res.status(400).json({
                error: 'Google Login Failed. Try again'
            })
        }
    })
}

// Facebook login
exports.facebookLogin = (req, res) => {
    console.log('FACEBOOK LOGIN REQ BODY', req.body)
    const { userID, accessToken } = req.body

    const url = `https://graph.facebook.com/v20.11/${userID}/?field=id,name,email&access_token=${accessToken}`

    return (
        fetch(url, {
            method: 'GET'
        })
            .then(res => res.json())
            .then(res => {
                const { email, name } = res
                User.findOne({ email }).exec((err, user) => {
                    if (user) {
                        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
                        const { _id, email, name, role } = user;
                        return res.json({
                            token,
                            user: { _id, email, name, role }
                        });
                    } else {
                        let password = email + process.env.JWT_SECRET;
                        user = new User({ name, email, password });
                        user.save((err, data) => {
                            if (err) {
                                console.log('ERROR FACEBOOK LOGIN ON USER SAVE', err);
                                return res.status(400).json({
                                    error: 'User signup failed with facebook'
                                });
                            }
                            const token = jwt.sign({ _id: data._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
                            const { _id, email, name, role } = data;
                            return res.json({
                                token,
                                user: { _id, email, name, role }
                            });
                        });
                    }
                });
            })
            .catch(error => {
                res.json({
                    error: 'Facebook login failed. Try later'
                });
            })
    );
};
