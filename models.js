// models.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  progress: { type: Number, default: 0 },
  gameprogress: { type: String, default: "Chapter1" },
  weakness: { type: Array, default: [] },
});
const User = mongoose.models.Users || mongoose.model('Users', userSchema);

const keywordSchema = new mongoose.Schema({
  word: { type: String, required: true },
  hint: { type: String },
  level: { type: String },
  category: { type: String },
  chapter: { type: String },
});
// Default keywords model (explicit collection name)
const Keyword = mongoose.models.Keywords || mongoose.model('Keywords', keywordSchema, 'keywords');
// Kratin-specific collection mapping
const KeywordKratin = mongoose.models.KeywordKratin || mongoose.model('KeywordKratin', keywordSchema, 'keywordskratin');

// Helper to select model by origin
function getKeywordModel(origin) {
  const normalized = (origin || '').toString().trim();
  const useKratin = normalized === 'https://kratin-tan.vercel.app';
  const model = useKratin ? KeywordKratin : Keyword;
  console.log(`[DB] getKeywordModel -> origin: "${normalized}" => collection: "${useKratin ? 'keywordskratin' : 'keywords'}"`);
  return model;
}

const gameplaySchema = new mongoose.Schema({
  roomCode: { type: String, required: true },
  hinter: [{ _id: String, name: String }],
  guesser: [{ _id: String, name: String }],
  mistakes: { type: [String], required: true },
  score: { type: Number, required: true },
  resultsPerPlayer: [{
    userId: String,
    role: { type: String, enum: ['hinter', 'guesser'] },
    keyword: String,
    result: { type: String, enum: ['TT', 'FT', 'FF'] },
    usedHint: Boolean,
    chapter: String,
    difficulty: String,
    timestamp: { type: Date, default: Date.now }
  }]
});
const Gameplay = mongoose.models.Gameplay || mongoose.model('Gameplay', gameplaySchema);

export { User, Keyword, KeywordKratin, Gameplay, getKeywordModel };
