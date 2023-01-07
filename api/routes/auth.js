const express = require('express')
const router = express.Router();

//import controllers
const { 
    signup,
    home, 
    accountActivation, 
    signin, 
    forgotPassword,
    resetPassword,
    googleLogin,
    facebookLogin
    } = require('../controllers/auth')

// Import validators
const { 
    userSignupValidator, 
    userSigninValidator, 
    forgotPasswordValidator, 
    resetPasswordValidator
     } = require('../validators/auth')

const { runValidation } = require('../validators/index')

router.get('/', home)
router.post('/signup', userSignupValidator, runValidation, signup)
router.post('/account-activation', accountActivation)
router.post('/signin', userSigninValidator, runValidation, signin)

router.put('/forgot-password', forgotPasswordValidator, runValidation, forgotPassword)
router.put('/reset-password', resetPasswordValidator, runValidation, resetPassword )

//social login
router.post('/google-login', googleLogin)
router.post('/facebook-login', facebookLogin)

module.exports = router