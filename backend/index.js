require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { execSync } = require('child_process');
const { Model, KaldiRecognizer } = require('vosk');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure 'uploads' directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Load Vosk model (download model if not already available)
const MODEL_PATH = 'model'; // Change this path based on your model location
if (!fs.existsSync(MODEL_PATH)) {
    console.error(`Vosk model not found in ${MODEL_PATH}. Download it from https://alphacephei.com/vosk/models.`);
    process.exit(1);
}
const model = new Model(MODEL_PATH);

// Setup Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files in 'uploads' directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname); // Rename with timestamp
    }
});
const upload = multer({ storage });

// Function to convert audio to WAV format with 16kHz sample rate (Vosk requirement)
const convertToWav = (inputPath, outputPath) => {
    execSync(`ffmpeg -i ${inputPath} -ac 1 -ar 16000 -y ${outputPath}`);
};

// Vosk Transcription API Route
app.post('/transcribe', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const inputAudioPath = req.file.path;
        const convertedAudioPath = `${inputAudioPath}.wav`;

        console.log(`Received audio file: ${inputAudioPath}`);

        // Convert audio to WAV format
        convertToWav(inputAudioPath, convertedAudioPath);

        // Read converted audio file
        const audioBuffer = fs.readFileSync(convertedAudioPath);
        const recognizer = new KaldiRecognizer(model, 16000);
        
        // Process audio in chunks
        recognizer.AcceptWaveform(audioBuffer);
        const result = JSON.parse(recognizer.FinalResult());

        console.log('Transcription received:', result.text);

        // Clean up files
        fs.unlinkSync(inputAudioPath);
        fs.unlinkSync(convertedAudioPath);

        res.json({ transcription: result.text });

    } catch (error) {
        console.error('Error transcribing audio:', error.message);
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
