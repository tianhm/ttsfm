// TTSFM Playground JavaScript

// Global variables
let currentAudioBlob = null;
let currentFormat = 'mp3';
let batchResults = [];

// Initialize playground
document.addEventListener('DOMContentLoaded', function() {
    initializePlayground();
});

// Check authentication status and show/hide API key field
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth-status');
        const data = await response.json();

        const apiKeySection = document.getElementById('api-key-section');
        if (apiKeySection) {
            if (data.api_key_required) {
                // Show API key field and mark as required
                apiKeySection.style.display = 'block';
                const apiKeyInput = document.getElementById('api-key-input');
                const label = apiKeySection.querySelector('label');

                if (apiKeyInput) {
                    apiKeyInput.required = true;
                    apiKeyInput.placeholder = 'Enter your API key (required)';
                }

                if (label) {
                    label.innerHTML = '<i class="fas fa-key me-2"></i>' + (window.currentLocale === 'zh' ? 'API密钥（必需）' : 'API Key (Required)');
                }

                // Update form text
                const formText = apiKeySection.querySelector('.form-text');
                if (formText) {
                    formText.innerHTML = '<i class="fas fa-exclamation-triangle me-1 text-warning"></i>API key protection is enabled - this field is required';
                }
            } else {
                // Hide API key field or mark as optional
                apiKeySection.style.display = 'none';
            }
        }
    } catch (error) {
        console.warn('Could not check auth status:', error);
        // If we can't check, assume API key might be required and show the field
        const apiKeySection = document.getElementById('api-key-section');
        if (apiKeySection) {
            apiKeySection.style.display = 'block';
        }
    }
}

function initializePlayground() {
    console.log('Initializing playground...');
    checkAuthStatus();
    loadVoices();
    loadFormats();
    updateCharCount();
    setupEventListeners();
    console.log('Playground initialization complete');

    // Initialize tooltips if Bootstrap is available
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

function setupEventListeners() {
    console.log('Setting up event listeners...');

    // Form and input events
    const textInput = document.getElementById('text-input');
    if (textInput) {
        textInput.addEventListener('input', updateCharCount);
        console.log('Text input event listener added');
    } else {
        console.error('Text input element not found!');
    }

    // Add form submit event listener with better error handling
    const form = document.getElementById('tts-form');
    if (form) {
        form.addEventListener('submit', function(event) {
            console.log('Form submit event triggered');
            event.preventDefault(); // Prevent default form submission
            event.stopPropagation(); // Stop event bubbling
            generateSpeech(event);
            return false; // Additional prevention
        });
    } else {
        console.error('TTS form not found!');
    }

    const maxLengthInput = document.getElementById('max-length-input');
    if (maxLengthInput) {
        maxLengthInput.addEventListener('input', updateCharCount);
        console.log('Max length input event listener added');
    } else {
        console.error('Max length input element not found!');
    }

    const autoCombineCheck = document.getElementById('auto-combine-check');
    if (autoCombineCheck) {
        autoCombineCheck.addEventListener('change', updateAutoCombineStatus);
    }

    // Enhanced button events
    const validateBtn = document.getElementById('validate-text-btn');
    if (validateBtn) {
        validateBtn.addEventListener('click', validateText);
        console.log('Validate button event listener added');
    } else {
        console.error('Validate button not found!');
    }

    const randomBtn = document.getElementById('random-text-btn');
    if (randomBtn) {
        randomBtn.addEventListener('click', loadRandomText);
        console.log('Random text button event listener added');
    } else {
        console.error('Random text button not found!');
    }

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadAudio);
        console.log('Download button event listener added');
    } else {
        console.error('Download button not found!');
    }

    // Add direct click event listener for generate button as backup
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', function(event) {
            console.log('Generate button clicked directly');
            event.preventDefault();
            event.stopPropagation();
            generateSpeech(event);
            return false;
        });
    }

    // New button events
    const clearTextBtn = document.getElementById('clear-text-btn');
    if (clearTextBtn) {
        clearTextBtn.addEventListener('click', clearText);
    }



    const resetFormBtn = document.getElementById('reset-form-btn');
    if (resetFormBtn) {
        resetFormBtn.addEventListener('click', resetForm);
    }

    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) {
        replayBtn.addEventListener('click', replayAudio);
    }

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareAudio);
    }

    // API Key visibility toggle
    const toggleApiKeyBtn = document.getElementById('toggle-api-key-visibility');
    if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
    }

    // Voice and format selection events
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect) {
        voiceSelect.addEventListener('change', updateVoiceInfo);
        console.log('Voice select event listener added');
    } else {
        console.error('Voice select element not found!');
    }

    const formatSelect = document.getElementById('format-select');
    if (formatSelect) {
        formatSelect.addEventListener('change', updateFormatInfo);
        console.log('Format select event listener added');
    } else {
        console.error('Format select element not found!');
    }

    // Example text buttons
    document.querySelectorAll('.use-example').forEach(button => {
        button.addEventListener('click', function() {
            document.getElementById('text-input').value = this.dataset.text;
            updateCharCount();
            // Add visual feedback
            this.classList.add('btn-success');
            setTimeout(() => {
                this.classList.remove('btn-success');
                this.classList.add('btn-outline-primary');
            }, 1000);
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to generate speech
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('generate-btn').click();
        }

        // Escape to clear results
        if (e.key === 'Escape') {
            clearResults();
        }
    });

    // Initialize auto-combine status
    updateAutoCombineStatus();
}

async function loadVoices() {
    try {
        // Prepare headers for API key if available (OpenAI compatible format)
        const headers = {};
        const apiKeyInput = document.getElementById('api-key-input');
        if (apiKeyInput && apiKeyInput.value.trim()) {
            headers['Authorization'] = `Bearer ${apiKeyInput.value.trim()}`;
        }

        const response = await fetch('/api/voices', { headers });
        const data = await response.json();
        
        const select = document.getElementById('voice-select');
        select.innerHTML = '';
        
        data.voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.id;
            option.textContent = `${voice.name} - ${voice.description}`;
            select.appendChild(option);
        });
        
        // Select default voice
        select.value = 'alloy';
        
    } catch (error) {
        console.error('Failed to load voices:', error);
        console.log('Failed to load voices. Please refresh the page.');
    }
}

async function loadFormats() {
    try {
        // Prepare headers for API key if available (OpenAI compatible format)
        const headers = {};
        const apiKeyInput = document.getElementById('api-key-input');
        if (apiKeyInput && apiKeyInput.value.trim()) {
            headers['Authorization'] = `Bearer ${apiKeyInput.value.trim()}`;
        }

        const response = await fetch('/api/formats', { headers });
        const data = await response.json();

        const select = document.getElementById('format-select');
        select.innerHTML = '';

        data.formats.forEach(format => {
            const option = document.createElement('option');
            option.value = format.id;
            option.textContent = `${format.name} - ${format.description}`;
            select.appendChild(option);
        });

        // Select default format
        select.value = 'mp3';
        updateFormatInfo();

    } catch (error) {
        console.error('Failed to load formats:', error);
        console.log('Failed to load formats. Please refresh the page.');
    }
}

function updateCharCount() {
    const textInput = document.getElementById('text-input');
    const maxLengthInput = document.getElementById('max-length-input');
    const charCountElement = document.getElementById('char-count');

    if (!textInput || !maxLengthInput || !charCountElement) {
        console.warn('Required elements not found for updateCharCount');
        return;
    }

    const text = textInput.value;
    const maxLength = parseInt(maxLengthInput.value) || 4096;
    const charCount = text.length;

    charCountElement.textContent = charCount.toLocaleString();
    
    // Update length status with better visual feedback
    const statusElement = document.getElementById('length-status');
    if (statusElement) {
        const percentage = (charCount / maxLength) * 100;

        if (charCount > maxLength) {
            statusElement.innerHTML = '<span class="badge bg-danger"><i class="fas fa-exclamation-triangle me-1"></i>Exceeds limit</span>';
        } else if (percentage > 80) {
            statusElement.innerHTML = '<span class="badge bg-warning"><i class="fas fa-exclamation me-1"></i>Near limit</span>';
        } else if (percentage > 50) {
            statusElement.innerHTML = '<span class="badge bg-info"><i class="fas fa-info me-1"></i>Good</span>';
        } else {
            statusElement.innerHTML = '<span class="badge bg-success"><i class="fas fa-check me-1"></i>OK</span>';
        }
    }
    
    updateGenerateButton();
    updateAutoCombineStatus();
}

function updateGenerateButton() {
    const text = document.getElementById('text-input').value;
    const maxLength = parseInt(document.getElementById('max-length-input').value) || 4096;
    const autoCombineCheck = document.getElementById('auto-combine-check');
    const autoCombine = autoCombineCheck ? autoCombineCheck.checked : false;
    const generateBtn = document.getElementById('generate-btn');

    if (!generateBtn) {
        console.warn('Generate button not found');
        return;
    }

    const btnText = generateBtn.querySelector('.btn-text');

    if (!btnText) {
        console.warn('Button text element not found');
        return;
    }

    if (text.length > maxLength && autoCombine) {
        btnText.innerHTML = '<i class="fas fa-magic me-2"></i>Generate Speech (Auto-Combine)';
        generateBtn.classList.add('btn-warning');
        generateBtn.classList.remove('btn-primary');
    } else {
        btnText.innerHTML = '<i class="fas fa-magic me-2"></i>Generate Speech';
        generateBtn.classList.add('btn-primary');
        generateBtn.classList.remove('btn-warning');
    }
}

async function validateText() {
    const text = document.getElementById('text-input').value.trim();
    const maxLength = parseInt(document.getElementById('max-length-input').value) || 4096;
    
    if (!text) {
        console.log('Please enter some text to validate');
        return;
    }
    
    const validateBtn = document.getElementById('validate-text-btn');
    setLoading(validateBtn, true);
    
    try {
        const response = await fetch('/api/validate-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, max_length: maxLength })
        });
        
        const data = await response.json();
        const resultDiv = document.getElementById('validation-result');
        
        if (data.is_valid) {
            resultDiv.innerHTML = `
                <div class="alert alert-success fade-in">
                    <i class="fas fa-check-circle me-2"></i>
                    <strong>Text is valid!</strong> (${data.text_length.toLocaleString()} characters)
                    <div class="progress progress-custom mt-2">
                        <div class="progress-bar-custom" style="width: ${(data.text_length / data.max_length) * 100}%"></div>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-warning fade-in">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Text exceeds limit!</strong> (${data.text_length.toLocaleString()}/${data.max_length.toLocaleString()} characters)
                    <br><small class="mt-2 d-block">Suggested chunks: ${data.suggested_chunks}</small>
                    <div class="mt-3">
                        <strong>Preview of chunks:</strong>
                        <div class="mt-2">
                            ${data.chunk_preview.map((chunk, i) => `
                                <div class="border rounded p-2 mb-2 bg-light">
                                    <small class="text-muted">Chunk ${i+1}:</small>
                                    <div class="small">${chunk}</div>
                                </div>
                            `).join('')}
                        </div>

                    </div>
                </div>
            `;
        }
        
        resultDiv.classList.remove('d-none');
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        console.error('Validation failed:', error);
        console.log('Failed to validate text. Please try again.');
    } finally {
        setLoading(validateBtn, false);
    }
}



function updateAutoCombineStatus() {
    const autoCombineCheck = document.getElementById('auto-combine-check');
    const statusBadge = document.getElementById('auto-combine-status');
    const textInput = document.getElementById('text-input');
    const maxLength = parseInt(document.getElementById('max-length-input').value) || 4096;

    if (!autoCombineCheck || !statusBadge) return;

    const isAutoCombineEnabled = autoCombineCheck.checked;
    const textLength = textInput.value.length;
    const isLongText = textLength > maxLength;

    // Show/hide status badge
    if (isAutoCombineEnabled && isLongText) {
        statusBadge.classList.remove('d-none');
        statusBadge.classList.add('bg-success');
        statusBadge.classList.remove('bg-warning');
        statusBadge.innerHTML = '<i class="fas fa-magic me-1"></i>Auto-combine enabled';
    } else if (!isAutoCombineEnabled && isLongText) {
        statusBadge.classList.remove('d-none');
        statusBadge.classList.add('bg-warning');
        statusBadge.classList.remove('bg-success');
        statusBadge.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Long text detected';
    } else {
        statusBadge.classList.add('d-none');
    }

    // Remove the recursive call to updateCharCount() - this was causing infinite recursion
}

async function generateSpeech(event) {
    console.log('generateSpeech function called');

    // Prevent default form submission behavior
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const button = document.getElementById('generate-btn');
    const audioResult = document.getElementById('audio-result');

    // Get form data
    const formData = getFormData();

    if (!validateFormData(formData)) {
        console.log('Form validation failed');
        return false;
    }

    // Show loading state
    setLoading(button, true);
    clearResults();

    try {
        console.log('Starting speech generation...');
        // Always use the unified endpoint with auto-combine
        await generateUnifiedSpeech(formData);
        console.log('Speech generation completed successfully');
    } catch (error) {
        console.error('Generation failed:', error);
        console.log(`Failed to generate speech: ${error.message}`);
    } finally {
        setLoading(button, false);
    }

    return false; // Ensure form doesn't submit
}

function getFormData() {
    return {
        text: document.getElementById('text-input').value.trim(),
        voice: document.getElementById('voice-select').value,
        format: document.getElementById('format-select').value,
        instructions: document.getElementById('instructions-input').value.trim(),
        maxLength: parseInt(document.getElementById('max-length-input').value) || 4096,
        validateLength: document.getElementById('validate-length-check').checked,
        autoCombine: document.getElementById('auto-combine-check').checked,
        apiKey: document.getElementById('api-key-input').value.trim()
    };
}

function validateFormData(formData) {
    if (!formData.text || !formData.voice || !formData.format) {
        console.log('Please fill in all required fields');
        return false;
    }

    if (formData.text.length > formData.maxLength && formData.validateLength && !formData.autoCombine) {
        console.log(`Text is too long (${formData.text.length} characters). Enable auto-combine or reduce text length.`);
        return false;
    }

    return true;
}

function clearResults() {
    document.getElementById('audio-result').classList.add('d-none');
    const batchResult = document.getElementById('batch-result');
    if (batchResult) {
        batchResult.classList.add('d-none');
    }
    document.getElementById('validation-result').classList.add('d-none');
}

// Utility functions
function setLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}



// New unified function using OpenAI-compatible endpoint with auto-combine
async function generateUnifiedSpeech(formData) {
    const audioResult = document.getElementById('audio-result');

    // Prepare headers
    const headers = { 'Content-Type': 'application/json' };

    // Add API key if provided (OpenAI compatible format)
    if (formData.apiKey) {
        headers['Authorization'] = `Bearer ${formData.apiKey}`;
    }

    const response = await fetch('/v1/audio/speech', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: 'gpt-4o-mini-tts',
            input: formData.text,
            voice: formData.voice,
            response_format: formData.format,
            instructions: formData.instructions || undefined,
            auto_combine: formData.autoCombine,
            max_length: formData.maxLength
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || errorData.error || `HTTP ${response.status}`;
        throw new Error(errorMessage);
    }

    // Get audio data
    const audioBlob = await response.blob();
    currentAudioBlob = audioBlob;
    currentFormat = formData.format;

    // Create audio URL and setup player
    const audioUrl = URL.createObjectURL(audioBlob);
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = audioUrl;

    // Get response headers for enhanced display
    const chunksCount = response.headers.get('X-Chunks-Combined') || '1';
    const autoCombineUsed = response.headers.get('X-Auto-Combine') === 'true';
    const originalLength = response.headers.get('X-Original-Text-Length');

    // Use enhanced display function with new metadata
    displayAudioResult(audioBlob, formData.format, formData.voice, formData.text, {
        chunksCount,
        autoCombineUsed,
        originalLength
    });

    console.log('Speech generated successfully! Click play to listen.');
    if (autoCombineUsed && chunksCount > 1) {
        console.log(`Auto-combine feature combined ${chunksCount} chunks into a single audio file.`);
    }

    // Auto-play if user prefers
    if (localStorage.getItem('autoPlay') === 'true') {
        audioPlayer.play().catch(() => {
            // Auto-play blocked, that's fine
        });
    }
}

// Legacy function for backward compatibility
async function generateSingleSpeech(formData) {
    // Use the new unified function
    await generateUnifiedSpeech(formData);
}





function downloadAudio() {
    if (!currentAudioBlob) {
        console.log('No audio to download');
        return;
    }

    const url = URL.createObjectURL(currentAudioBlob);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    downloadFromUrl(url, `ttsfm-speech-${timestamp}.${currentFormat}`);
    URL.revokeObjectURL(url);
}



function downloadFromUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// New enhanced functions
function clearText() {
    document.getElementById('text-input').value = '';
    updateCharCount();
    clearResults();
    console.log('Text cleared successfully');
}

function loadRandomText() {
    const randomTexts = [
        // News & Information
        "Breaking news: Scientists have discovered a revolutionary new method for generating incredibly natural synthetic speech using advanced neural networks and machine learning algorithms.",
        "Weather update: Today will be partly cloudy with temperatures reaching 75 degrees Fahrenheit. Light winds from the southwest at 5 to 10 miles per hour.",
        "Technology report: The latest advancements in artificial intelligence are revolutionizing how we interact with digital devices and services.",

        // Educational & Informative
        "The human brain contains approximately 86 billion neurons, each connected to thousands of others, creating a complex network that enables consciousness, memory, and thought.",
        "Photosynthesis is the process by which plants convert sunlight, carbon dioxide, and water into glucose and oxygen, forming the foundation of most life on Earth.",
        "The speed of light in a vacuum is exactly 299,792,458 meters per second, making it one of the fundamental constants of physics.",

        // Creative & Storytelling
        "Once upon a time, in a land far away, there lived a wise old wizard who could speak to the stars and understand their ancient secrets.",
        "The mysterious lighthouse stood alone on the rocky cliff, its beacon cutting through the fog like a sword of light, guiding lost ships safely home.",
        "In the depths of the enchanted forest, where sunbeams danced through emerald leaves, a young adventurer discovered a hidden path to destiny.",

        // Business & Professional
        "Our quarterly results demonstrate strong growth across all market segments, with revenue increasing by 23% compared to the same period last year.",
        "The new product launch exceeded expectations, capturing 15% market share within the first six months and establishing our brand as an industry leader.",
        "We are committed to sustainable business practices that benefit our customers, employees, and the environment for generations to come.",

        // Technical & Programming
        "The TTSFM package provides a comprehensive API for text-to-speech generation with support for multiple voices and audio formats.",
        "Machine learning algorithms process vast amounts of data to identify patterns and make predictions with remarkable accuracy.",
        "Cloud computing has transformed how businesses store, process, and access their data, enabling scalability and flexibility like never before.",

        // Conversational & Casual
        "Welcome to TTSFM! Experience the future of text-to-speech technology with our premium AI voices.",
        "Good morning! Today is a beautiful day to learn something new and explore the possibilities of text-to-speech technology.",
        "Have you ever wondered what it would be like if your computer could speak with perfect human-like intonation and emotion?"
    ];

    const randomText = randomTexts[Math.floor(Math.random() * randomTexts.length)];
    document.getElementById('text-input').value = randomText;
    updateCharCount();
    console.log('Random text loaded successfully');
}



function resetForm() {
    // Reset form to default values
    document.getElementById('text-input').value = 'Welcome to TTSFM! Experience the future of text-to-speech technology with our premium AI voices. Generate natural, expressive speech for any application.';
    document.getElementById('voice-select').value = 'alloy';
    document.getElementById('format-select').value = 'mp3';
    document.getElementById('instructions-input').value = '';
    document.getElementById('max-length-input').value = '4096';
    document.getElementById('validate-length-check').checked = true;
    const autoCombineCheck = document.getElementById('auto-combine-check');
    if (autoCombineCheck) {
        autoCombineCheck.checked = true;
    }

    updateCharCount();
    updateGenerateButton();
    clearResults();
    console.log('Form reset to default values');
}

function replayAudio() {
    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer && audioPlayer.src) {
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(() => {
            console.log('Unable to replay audio. Please check your browser settings.');
        });
    }
}

function shareAudio() {
    if (navigator.share && currentAudioBlob) {
        const file = new File([currentAudioBlob], `ttsfm-speech.${currentFormat}`, {
            type: `audio/${currentFormat}`
        });

        navigator.share({
            title: 'TTSFM Generated Speech',
            text: 'Check out this speech generated with TTSFM!',
            files: [file]
        }).catch(() => {
            // Fallback to copying link
            copyAudioLink();
        });
    } else {
        copyAudioLink();
    }
}

function copyAudioLink() {
    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer && audioPlayer.src) {
        navigator.clipboard.writeText(audioPlayer.src).then(() => {
            console.log('Audio link copied to clipboard!');
        }).catch(() => {
            console.log('Unable to copy link. Please try downloading the audio instead.');
        });
    }
}

function updateVoiceInfo() {
    const voiceSelect = document.getElementById('voice-select');
    const previewBtn = document.getElementById('preview-voice-btn');

    if (voiceSelect.value) {
        previewBtn.disabled = false;
        previewBtn.onclick = () => previewVoice(voiceSelect.value);
    } else {
        previewBtn.disabled = true;
    }
}

function updateFormatInfo() {
    const formatSelect = document.getElementById('format-select');
    const formatInfo = document.getElementById('format-info');

    const formatDescriptions = {
        'mp3': '🎵 MP3 - Good quality, small file size. Best for web and general use.',
        'opus': '📻 OPUS - Excellent quality, small file size. Best for streaming and VoIP.',
        'aac': '📱 AAC - Good quality, medium file size. Best for Apple devices and streaming.',
        'flac': '💿 FLAC - Lossless quality, large file size. Best for archival and high-quality audio.',
        'wav': '🎧 WAV - Lossless quality, large file size. Best for professional audio production.',
        'pcm': '🔊 PCM - Raw audio data, large file size. Best for audio processing.'
    };

    if (formatInfo && formatSelect.value) {
        formatInfo.textContent = formatDescriptions[formatSelect.value] || 'High-quality audio format';
    }
}

function previewVoice(voiceId) {
    // This would typically play a short preview of the voice
    console.log(`Voice preview for ${voiceId} - Feature coming soon!`);
}

// Enhanced audio result display with auto-combine metadata
function displayAudioResult(audioBlob, format, voice, text, metadata = {}) {
    const audioResult = document.getElementById('audio-result');
    const audioPlayer = document.getElementById('audio-player');
    const audioInfo = document.getElementById('audio-info');

    // Create audio URL and setup player
    const audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;

    // Update audio stats
    const sizeKB = (audioBlob.size / 1024).toFixed(1);
    document.getElementById('audio-size').textContent = `${sizeKB} KB`;
    document.getElementById('audio-format').textContent = format.toUpperCase();
    document.getElementById('audio-voice').textContent = voice.charAt(0).toUpperCase() + voice.slice(1);

    // Update audio info safely without innerHTML
    // Clear existing content
    audioInfo.textContent = '';

    // Create and append icon element
    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle text-success me-1';
    audioInfo.appendChild(icon);

    // Create info text with auto-combine details
    let infoText = `Generated successfully • ${sizeKB} KB • ${format.toUpperCase()}`;

    if (metadata.autoCombineUsed && metadata.chunksCount > 1) {
        infoText += ` • Auto-combined ${metadata.chunksCount} chunks`;

        // Add a special badge for auto-combine
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary ms-2';
        badge.innerHTML = '<i class="fas fa-magic me-1"></i>Auto-combined';
        audioInfo.appendChild(document.createTextNode(infoText));
        audioInfo.appendChild(badge);
    } else {
        // Create and append text content (safely escaped)
        const textNode = document.createTextNode(infoText);
        audioInfo.appendChild(textNode);
    }

    // Show result with animation
    audioResult.classList.remove('d-none');
    audioResult.classList.add('fade-in');

    // Update duration when metadata loads
    audioPlayer.addEventListener('loadedmetadata', function() {
        const duration = Math.round(audioPlayer.duration);
        document.getElementById('audio-duration').textContent = `${duration}s`;
    }, { once: true });

    // Scroll to result
    audioResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// API Key visibility toggle function
function toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('api-key-input');
    const eyeIcon = document.getElementById('api-key-eye-icon');

    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        eyeIcon.className = 'fas fa-eye-slash';
    } else {
        apiKeyInput.type = 'password';
        eyeIcon.className = 'fas fa-eye';
    }
}

// Export functions for use in HTML
window.clearText = clearText;
window.loadRandomText = loadRandomText;
window.resetForm = resetForm;
window.toggleApiKeyVisibility = toggleApiKeyVisibility;
