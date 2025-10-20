import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url'; 
import { Server as SocketIO } from 'socket.io';
import dotenv from 'dotenv';

import { User, Gameplay, getKeywordModel } from './models.js';
import { setupSocket } from './socket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const { urlencoded, json } = bodyParser;

const mongo_uri = process.env.MONGO_URI;// || "mongodb://localhost:27017/fallback";
mongoose.connect(mongo_uri, { useNewUrlParser: true })
  .then(() => console.log('[MongoDB] Connected'))
  .catch(err => {
    console.error('[MongoDB] Connection error:', err);
    process.exit(1);
  });

  app.use(cors({
    origin: ['https://cellvivortest.vercel.app','https://kratin-tan.vercel.app'], // your frontend URL
    methods: ['GET', 'POST'],
    credentials: true
  }));

app.use(urlencoded({ extended: true }));
app.use(json());

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/', (req, res) => {
  res.send('Hello from backend!');
});

// Your existing REST API endpoints (e.g. /users, /keywords, /api routes)
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.post('/users', async (req, res) => {
  try {
    const newUser = new User(req.body);
    const saved = await newUser.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// ... Add the rest of your API routes here (copy from your original code)
app.get('/test/:id', (req, res) => {
  res.send(`Received ID: ${req.params.id}`);
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.post('/users', async (req, res) => {
  try {
    const newUser = new User(req.body);
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.get('/keywords', async (req, res) => {
  try {
    const Keyword = getKeywordModel(req.headers.origin);
    const keywords = await Keyword.find();
    res.json(keywords);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.post('/keywords', async (req, res) => {
  try {
    const Keyword = getKeywordModel(req.headers.origin);
    const newKeyword = new Keyword(req.body);
    const savedKeyword = await newKeyword.save();
    res.status(201).json(savedKeyword);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.get('/api/random-keyword', async (req, res) => {
  try {
    const Keyword = getKeywordModel(req.headers.origin);
    const count = await Keyword.countDocuments();
    if (count === 0) return res.status(404).json({ error: 'No keywords found' });
    const random = Math.floor(Math.random() * count);
    const keywordDoc = await Keyword.findOne().skip(random);
    res.json({ keyword: keywordDoc.word, hint: keywordDoc.hint });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/keywords/random?difficulty=easy
app.get('/api/keywords/random', async (req, res) => {
  try {
    const { difficulty } = req.query;
    if (!difficulty) {
      return res.status(400).json({ error: 'Missing difficulty parameter' });
    }
    const Keyword = getKeywordModel(req.headers.origin);

    const keyword = await Keyword.aggregate([
      { $match: { level: difficulty } },
      { $sample: { size: 1 } }
    ]);

    if (!keyword || keyword.length === 0) {
      return res.status(404).json({ error: 'No keyword found for this difficulty' });
    }

    res.json(keyword[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// Patch user progress
app.patch('/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { progress: req.body.progress },
      { new: true }
    );
    if (!updatedUser) return res.status(404).send("User not found");
    res.json(updatedUser);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.post('/api/gameplay-mistake', async (req, res) => {
  try {
    const { roomCode, result, keyword } = req.body;
    if (!roomCode || !result || !keyword) {
      return res.status(400).json({ error: 'Missing roomCode, result, or keyword' });
    }

    const gameplay = await Gameplay.findOne({ roomCode });
    if (!gameplay) {
      return res.status(404).json({ error: 'Gameplay not found' });
    }

    gameplay.mistakes.push(`${result}:${keyword}`);
    if (result === 'TT') gameplay.score += 2;
    else if (result === 'FT') gameplay.score += 1;

    await gameplay.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SAVE PLAYER RESULT (บันทึกผลแต่ละรอบ)
app.post('/api/save-player-result', async (req, res) => {
  try {
    const { roomCode, userId, role, keyword, result, usedHint } = req.body;

    if (!roomCode || !userId || !role || !keyword || !result) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const gameplay = await Gameplay.findOne({ roomCode });
    if (!gameplay) {
      return res.status(404).json({ error: 'Gameplay not found' });
    }

    const Keyword = getKeywordModel(req.headers.origin);
    const keywordDoc = await Keyword.findOne({ word: keyword });
    const chapter = keywordDoc?.chapter || 'Unknown';
    const difficulty = keywordDoc?.level || 'medium';

    gameplay.resultsPerPlayer.push({
      userId,
      role,
      keyword,
      result,
      usedHint: !!usedHint,
      chapter,
      difficulty,
      timestamp: new Date()
    });

    await gameplay.save();
    res.json({ success: true });

  } catch (error) {
    console.error('[API] save-player-result error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADD WEAKNESS TO USER
app.patch('/api/users/:userId/add-weakness', async (req, res) => {
  const { userId } = req.params;
  const { newWeakness } = req.body;

  if (!Array.isArray(newWeakness)) {
    return res.status(400).json({ success: false, message: 'Invalid weakness data' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const combined = [...user.weakness, ...newWeakness];
    const uniqueWeakness = [...new Set(combined)];

    user.weakness = uniqueWeakness;
    await user.save();

    res.json({ success: true, updated: uniqueWeakness });
  } catch (error) {
    console.error('[API] add-weakness error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get gameplay history for graph
app.get('/api/user/:id/gameplay-history', async (req, res) => {
  try {
    const { id } = req.params;

    const sessions = await Gameplay.find({ 'resultsPerPlayer.userId': id })
      .sort({ createdAt: -1 })
      .limit(20);

    const data = sessions.map(session => {
      const playerResults = session.resultsPerPlayer.filter(r => r.userId === id);

      const totalHints = playerResults.filter(r => r.usedHint).length;
      const totalScore = playerResults.reduce((sum, r) => {
        if (r.result === 'TT') return sum + 2;
        if (r.result === 'FT') return sum + 1;
        return sum;
      }, 0);

      const times = playerResults.map(r => r.timestamp?.getTime()).filter(Boolean).sort((a, b) => a - b);
      const avgTime = times.length > 1
        ? (times[times.length - 1] - times[0]) / (times.length - 1)
        : 0;

      return {
        roomCode: session.roomCode,
        score: totalScore,
        avgTime: parseFloat(avgTime.toFixed(2)),
        hintsUsed: totalHints,
        timestamp: session.createdAt
      };
    });

    res.json(data);
  } catch (err) {
    console.error('History fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Multiplayer-aware score lookup
app.get('/api/gameplay-score', async (req, res) => {
  try {
    const { roomCode } = req.query;
    if (!roomCode) return res.status(400).json({ error: 'Missing roomCode' });
    const gameplay = await Gameplay.findOne({ roomCode });
    if (!gameplay) return res.json({ score: 0 });
    res.json({ score: gameplay.score });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Load game scene
app.get('/progress/load/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    console.log('Full user data:', user);
    console.log('gameprogress field:', user.gameprogress);
    res.json({ lastScene: user.gameprogress || "Chapter1" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Auth check
app.post('/api/check-user', async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findOne({ name, email });
    res.json({ exists: !!user });
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Signup
app.post('/api/signin', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const existing = await User.findOne({ name, email });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    const newUser = new User({
      name,
      email,
      progress: 0,               
      gameprogress: "Chapter1",  
      weakness: [],              
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      message: "Sign in successful",
      user: {
        _id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        progress: savedUser.progress,
        gameprogress: savedUser.gameprogress,
        weakness: savedUser.weakness,
      }
    });
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { name, email } = req.body;
    let user = await User.findOne({ name, email });

    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    // --- Patch missing fields for legacy users ---
    let updateNeeded = false;
    if (user.progress === undefined) {
      user.progress = 0;
      updateNeeded = true;
    }
    if (!user.gameprogress) {
      user.gameprogress = "Chapter1";
      updateNeeded = true;
    }
    if (!user.weakness || !Array.isArray(user.weakness)) {
      user.weakness = [];
      updateNeeded = true;
    }

    if (updateNeeded) await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        progress: user.progress,
        gameprogress: user.gameprogress,
        weakness: user.weakness,
      }
    });

  } catch (error) {
    res.status(500).send('Server error');
  }
});

//storyboardmode
app.post('/progress/save', async (req, res) => {
  const { userId, scene } = req.body;
  if (!userId || !scene || scene.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid userId or scene' });
  }
  try {
    await User.updateOne({ _id: userId }, { $set: { gameprogress: scene } });
    res.sendStatus(200);
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- WebSocket Setup ---
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: ['https://cellvivortest.vercel.app','https://kratin-tan.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
});
setupSocket(io);
// --- Fallback route ---
app.get('*', (req, res) => {
 /// res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
});

