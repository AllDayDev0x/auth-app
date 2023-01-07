const express = require('express')
const mongoose = require('mongoose')
const morgan = require('morgan')
const cors = require('cors')
const bodyParser = require('body-parser')
require('dotenv').config()

// Declaring PORT 
const PORT = process.env.PORT || 5000

// Importing Routes
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')

//initializing Express
const app = express()

// Database Connection
mongoose.connect(process.env.DATABASE, {
        useNewUrlParser: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
        useCreateIndex: true
    })
    .then(() => console.log('DATABASE IS CONNECTED'))
    .catch(err => console.error('DATABASE CONNECTION ERROR: ', err))

// app middleware
app.use(morgan('dev'))
app.use(bodyParser.json())
// app.use(cors()) //allows all origins
if(process.env.NODE_ENV = 'development') {
    app.use(cors({
        origin: `http://localhost:5000`
    }))
}

// Middleware
app.use('/', authRoutes)

app.use('/api', authRoutes)
app.use('/api', userRoutes)

app.listen(PORT, () => console.log(`API is running on port ${PORT}`))
