const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const NoteSchema = new Schema(
  {
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    content: String,
    title: String,
    contact: [{ type: mongoose.Schema.Types.ObjectId, ref: 'contact' }],
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'deal' },
    team_call: { type: mongoose.Schema.Types.ObjectId, ref: 'team_call' },
    shared_note: { type: mongoose.Schema.Types.ObjectId, ref: 'note' },
    has_shared: Boolean,
    assigned_contacts: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'contact' },
    ],
    audio: String,
    updated_at: Date,
    created_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

NoteSchema.index({ user: 1 });
NoteSchema.index({ contacts: 1 });
NoteSchema.index({ deal: 1 });
const Note = mongoose.model('note', NoteSchema);

module.exports = Note;
