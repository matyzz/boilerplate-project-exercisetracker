const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

mongoose.connect(process.env.wea, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: String,
  exercises: [{
    description: String,
    duration: Number,
    date: Date
  }]
});
const User = mongoose.model('User', userSchema);

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
app.use(bodyParser.urlencoded({
  extended: true
}));

// create a new user
app.post('/api/users', async (req, res) => {
  const userName = req.body.username;
  const userNameRegex = new RegExp('^[\\w\\-@ ]*$');

  // console.log(userName);
  // check if user name is valid
  if (!userName || !userNameRegex.test(userName)) {
    res.json({ error: 'Invalid username.' });
  } else {
    // check if its already saved
    try {
      let findOne = await User.findOne({
        username: userName
      });
      if (findOne) {
        res.json({ 
          username: findOne.username,
          _id: findOne.id
        });
      } else {
        // create a user object
        findOne = new User({ username: userName });
        // save user to db
        await findOne.save((err, user) => {
          if (err) {
            res.json({ error: JSON.stringify(err) });
          }
          res.json({ 
            username: user.username,
            _id: user.id
          });
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
});

// list all users
app.get('/api/users', (req, res) => {
  User.find((err, users) => {
    if (err) {
      res.json({ error: JSON.stringify(err) });
      console.error(err);
    }
    res.json(users);
  });
});

// delete users created during automated tests
app.get('/api/users/deleteTests', async (req, res) => {
  try {
    const deletedUsers = await User.deleteMany({
      username: /^fcc_test/
    })
    res.json({ deletedCount: deletedUsers.deletedCount });
  } catch (err) {
    console.error(err);
  }
});

// create an exercise for a user
app.post('/api/users/:id/exercises', async (req, res) => {
  const userId = req.params.id;
  const {description, duration} = req.body;
  let date = new Date(req.body.date);

  if (!req.body.date) {
    date = new Date();
  }

  // check if the user's ID is valid
  try {
    let foundUser = await User.findById(userId);
    if (foundUser){
      // create an Exercise Object
      const exercise = {
        description: description,
        duration: +duration,
        date: date
      };
      // console.log(`INPUT: ${exercise}`);
      // push exercise to user's array
      foundUser.exercises.push(exercise);
      // save the user to the db
      await foundUser.save((err, updatedUser) => {
        if (err) {
          res.json({ error: JSON.stringify(err) });
          console.error(err);
        }
        try {
          let response;
          response = {
            _id: updatedUser._id,
            username: updatedUser.username,
            date: date.toDateString(),
            duration: +duration,
            description: description
          };
          res.json(response);
          // console.log(typeof(response));
          console.log(response);
        } catch (err) {
          res.json({ error: JSON.stringify(err) });
          console.error(err);
        }
      });
    } else {
      res.json({
        error: "User not found"
      })
    }
  } catch (err) {
    res.json({ error: JSON.stringify(err) });
    console.error(err);
  }
});

// get a user's exexrcises
app.get('/api/users/:_id/logs/', async (req, res) => {
  const userId = req.params._id;
  const limit = +req.query.limit || 999;
  const from = new Date(req.query.from || -8640000000000000);
  const to = new Date(req.query.to || 8640000000000000) ;
  
  // find User
  try {
    // let foundUser = await User.findById(userId);
    let [foundUser] = await User.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(userId) }
      },{
        $project: {
          username: 1,
          exercises: {
            $slice: [
              {
                $filter: {
                  input: '$exercises',
                  as: 'exercise',
                  cond: {
                    $and: [
                      {
                        "$gte": [
                          "$$exercise.date", from
                        ]
                      },{
                        "$lt": [
                          "$$exercise.date", to
                        ]
                      }
                    ]
                  }
                }
              }, limit
            ]
          }
        }
      },{
        "$addFields": {
          "count": {
            $size: "$exercises"
          }
        }
      }
    ]);
    
    // console.log(`FOUND USER: |${(foundUser)}| - ${!!foundUser}`);
    if (foundUser){
      const response = {
        _id: foundUser._id,
        username: foundUser.username,
        count: foundUser.count,
        // convert date to date String
        log: foundUser.exercises.map(({
          description, duration, date
        }) => ({
          description: description,
          duration: duration,
          date: date.toDateString()
        }))
      };
      res.json(response);
      console.log(response);
    } else {
      res.json({
        error: "User not found"
      })
    }
  } catch (err) {
    res.json({ error: JSON.stringify(err) });
    console.error(err);
  }
});