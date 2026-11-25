const mongoose = require('mongoose');
const text = (required = false, maxlength = 250) => ({ type: String, trim: true, required, maxlength });
const options = { timestamps: true, strict: 'throw', optimisticConcurrency: true };
const ref = model => ({ type: mongoose.Schema.Types.ObjectId, ref: model, required: true, index: true });
module.exports = { mongoose, text, options, ref };
