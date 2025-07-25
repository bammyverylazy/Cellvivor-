import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  progress: { type: Number, required: true },
  gameprogress: { type: Number, required: true },
});

const User = mongoose.model('Users', userSchema);

export default User;