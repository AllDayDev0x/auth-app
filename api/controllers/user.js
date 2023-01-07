const User = require('../models/userModel')

exports.read = (req, res) => {
    const userId  = req.params.id
    User.findById(userId).exec((err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            })
        }
        user.hashed_password = undefined
        user.salt = undefined
        res.json(user)
    })
}

exports.update = (req, res) => {
    const { name, password } = req.body;

    User.findOne({ _id: req.user._id }, (err, user) => {
        if (err || !user) {
            return res.status(400).json({
                error: 'User not found'
            })
        }

        if (!name) {
            return res.status(400).json({
                error: 'Name not found'
            })
        } else {
            user.name = name
        }

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({
                    error: 'Password should have min 6 character long'
                })
            } else {
                user.password = password
            }
        }

        user.save((err, updateUser) => {
            if (err) {
                console.error('USER UPDATE ERROR', err)
                return res.status(400).json({
                    error: 'User update failed'
                })
            }
            updateUser.hashed_password = undefined
            updateUser.salt = undefined
            res.json(updateUser)
        })
    })
}