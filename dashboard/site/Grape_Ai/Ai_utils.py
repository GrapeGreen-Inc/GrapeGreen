# =====================================================================
# 1. CORE PYTHON UTILITIES (Math, Randomization, and Time Tracking)
# =====================================================================
import math                         # For advanced algebraic operations, floats, and constants
import random                       # For basic random sampling and seeding datasets
import time                         # For benchmarking model processing performance
import os                           # For interacting with your database and environment files
import sys                          # For processing dynamic command line system inputs
from datetime import datetime       # For tracking explicit user timestamps and log dates

# =====================================================================
# 2. NUMERICAL COMPUTATION & DATA ANALYTICS
# =====================================================================
import numpy as np                  # Core library for vector arrays, matrix math, and tensors
import pandas as pd                 # For reading datasets, csv strings, and database logs

# =====================================================================
# 3. CORE AI, MACHINE LEARNING, & STRUCTURAL NLP
# =====================================================================
import sklearn                      # Classic Machine Learning tools (Scikit-Learn)
from sklearn.model_selection import train_test_split  # Splits your data sets into training/test partitions
from sklearn.preprocessing import LabelEncoder        # Normalizes text tokens into standard index codes

# =====================================================================
# 4. DEEP LEARNING FRAMEWORKS & LIBRARIES
# =====================================================================
import torch                        # Core tensor library for training neural networks
import torch.nn as nn               # Building layers, loss functions, and activation loops
import torch.optim as optim         # Optimizers (Adam, SGD) to update network training weights
import requests                     # Vital addition for automated web-scraping and Wikipedia imports
import re                           # Regular expressions for deep regex string cleaning loops
import json                         # Used to load and write out persistent model variables

# =====================================================================
# 5. APP-SPECIFIC HYPERPARAMETERS & DICTIONARIES
# =====================================================================
parameterSettings = ["mood", "intent", "context", "target", "empathy", "persona"]
moods = ["happy", "sad", "angry", "scared", "flirty", "neutral", "disguised", "anxious"]
tiers = ["free", "plus", "pro", "max", "owner"]

BadCussWords = ["pussy", "nigger", "nigga", "fuck", "dick", "cock", "bitch", "ass", "asshole", "shit", "crap", "whore"]
IllegialStuff = ["hack", "murder", "rape", "theft"]
NEE_popup_keywords = ["suiside", "suicide", "kill myself", "end my life", "self harm", "cutting myself", "want to die"]

PARAMS_FILE = "params.json"

# =====================================================================
# 6. SIGNED 8-DIGIT FIXED POINT CONVERTER (SERIALIZER)
# =====================================================================
def format_to_grape_param(float_val):
    """Converts a floating-point number into an 8-digit explicit sign string [±.00000000]."""
    sign = "+" if float_val >= 0 else "-"
    absolute_val = abs(float_val)
    decimal_part = f"{absolute_val - int(absolute_val):.8f}"[2:]
    return f"[{sign}.{decimal_part}]"

def parse_from_grape_param(param_str):
    """Parses an 8-digit custom string back into a standard system float."""
    clean_str = param_str.replace("[", "").replace("]", "")
    sign = -1.0 if clean_str.startswith("-") else 1.0
    value = float(clean_str[1:])
    return sign * value

# =====================================================================
# 7. TEXT PREPROCESSING PIPELINE & SECURITY INTERCEPTOR
# =====================================================================
def preprocess_and_screen(raw_text_stream):
    """Advanced Preprocessing NLP Pipeline with safety filters and token mapping."""
    cleaned_string = raw_text_stream.lower().strip()
    
    if any(keyword in cleaned_string for keyword in NEE_popup_keywords):
        return {
            "status": "NEE_TRIGGERED",
            "output": "\n[⚠️ CRITICAL SYSTEM NOTICE: 988 LIFELINE CONTEXT INTERCEPT]\n"
                      "It looks like things are incredibly heavy right now. Please know help is close:\n"
                      "-> Call or text 988 to instantly connect to the Suicide & Crisis Lifeline.\n"
                      "-> Free, secure, private, and operating 24 hours a day, 7 days a week.\n"
                      "-> Official web resource portal: https://988lifeline.org\n"
        }
        
    if any(illegal in cleaned_string for illegal in IllegialStuff):
        return {
            "status": "BLOCKED",
            "output": "Grape AI: Fulfilling this operational request violates database safety parameters."
        }
        
    for word in BadCussWords:
        pattern = re.compile(rf'\b{word}\b', re.IGNORECASE)
        raw_text_stream = pattern.sub("🍇", raw_text_stream)
        
    token_ready_text = re.sub(r'[^\w\s]', '', raw_text_stream.lower())
    tokens = token_ready_text.split()
    
    return {
        "status": "PASSED", 
        "processed_text": raw_text_stream, 
        "tokens": tokens
    }
# =====================================================================
# 8. SMALL LANGUAGE MODEL PERSISTENT ENGINE (GrapeSLM)
# =====================================================================
class GrapeSLMBrain:
    def __init__(self):
        self.state_matrix = {}
        self.all_words = []
        self.load_parameters()
        
    def load_parameters(self):
        """Loads and converts saved custom strings from params.json back into live state lists."""
        if os.path.exists(PARAMS_FILE):
            try:
                with open(PARAMS_FILE, "r") as f:
                    serialized_data = json.load(f)
                    
                self.state_matrix = {}
                for key_string, weight_dict in serialized_data.get("matrix", {}).items():
                    context_tuple = tuple(key_string.split("::"))
                    self.state_matrix[context_tuple] = []
                    
                    for target_word, custom_weight_str in weight_dict.items():
                        parsed_weight = parse_from_grape_param(custom_weight_str)
                        occurrences = int(round(parsed_weight * 100))
                        if occurrences <= 0:
                            occurrences = 1
                        for _ in range(occurrences):
                            self.state_matrix[context_tuple].append(target_word)
                            
                self.all_words = serialized_data.get("vocabulary", [])
            except Exception:
                self.state_matrix = {}
        else:
            self.state_matrix = {}

    def save_parameters(self):
        """Saves weights formatted into the explicit sign [±.00000000] design layout inside params.json."""
        serialized_matrix = {}
        for context_tuple, next_words in self.state_matrix.items():
            key_string = f"{context_tuple[0]}::{context_tuple[1]}"
            serialized_matrix[key_string] = {}
            
            total_connections = len(next_words)
            unique_words = set(next_words)
            
            for word in unique_words:
                frequency = next_words.count(word)
                probability = frequency / total_connections
                serialized_matrix[key_string][word] = format_to_grape_param(probability)
                
        output_payload = {
            "vocabulary": list(set(self.all_words)),
            "matrix": serialized_matrix
        }
        
        with open(PARAMS_FILE, "w") as f:
            json.dump(output_payload, f, indent=4)

    def train_on_wikipedia(self, topic):
        """Web Fetch Interface: Automatically downloads context vectors from Wikipedia."""
        url = "https://wikipedia.org"
        params = {
            "action": "query",
            "format": "json",
            "prop": "extracts",
            "explaintext": True,
            "titles": topic
        }
        try:
            response = requests.get(url, params=params, timeout=10).json()
            pages = response.get("query", {}).get("pages", {})
            fetched_corpus = ""
            for _, page_data in pages.items():
                if "extract" in page_data:
                    fetched_corpus += page_data["extract"]
            
            if not fetched_corpus:
                return False
                
            self.optimize_weights(fetched_corpus)
            self.save_parameters()
            return True
        except Exception:
            return False

    def optimize_weights(self, clean_text_corpus):
        """Compiles predictive sequence arrays directly from data inputs."""
        sanitized_data = re.sub(r'\[.*?\]|\(.*?\)', '', clean_text_corpus)
        processed_tokens = [t.strip() for t in sanitized_data.split() if t.strip()]
        
        if len(processed_tokens) < 3:
            return
            
        self.all_words.extend([w.lower() for w in processed_tokens])
        
        for i in range(len(processed_tokens) - 2):
            context_key = (processed_tokens[i].lower(), processed_tokens[i+1].lower())
            next_predicted_word = processed_tokens[i+2]
            
            if context_key not in self.state_matrix:
                self.state_matrix[context_key] = []
            self.state_matrix[context_key].append(next_predicted_word)

    def inference(self, input_tokens, temperature=0.7, top_k=5, max_output_tokens=35):
        """Runs predictions through matrix state variables scaled by temperature constraints."""
        # Active Temporal Context Generation
        current_time_data = datetime.now()
        day_string = current_time_data.strftime("%A")
        date_string = current_time_data.strftime("%B %d, %Y")
        time_string = current_time_data.strftime("%I:%M %p")

        # Catch dynamic intent questions regarding time or dates explicitly
        raw_tokens_joined = " ".join(input_tokens)
        if "time" in raw_tokens_joined:
            return f"The current system time is exactly {time_string}."
        if "date" in raw_tokens_joined or "day" in raw_tokens_joined or "today" in raw_tokens_joined:
            return f"Today is {day_string}, {date_string}."

        if not self.state_matrix:
            return "Grape AI: My brain is empty. Type 'train <topic>' to load parameters!"

        seed_sequence = None
        for i in range(len(input_tokens) - 1):
            potential_key = (input_tokens[i], input_tokens[i+1])
            if potential_key in self.state_matrix:
                seed_sequence = potential_key
                break
                
        if not seed_sequence:
            seed_sequence = random.choice(list(self.state_matrix.keys()))
            
        response_tokens = [seed_sequence[0].capitalize(), seed_sequence[1]]
        current_state = seed_sequence
        
        for _ in range(max_output_tokens):
            if current_state not in self.state_matrix:
                break
                
            possible_words = self.state_matrix[current_state]
            counts = {}
            for w in possible_words:
                counts[w] = counts.get(w, 0) + 1
                
            sorted_candidates = [word for word, count in sorted(counts.items(), key=lambda x: x, reverse=True)]
            pruned_candidates = sorted_candidates[:top_k]
            
            if not pruned_candidates:
                break
                
            if temperature <= 0.1:
                chosen_token = pruned_candidates[0]
            else:
                decay_weights = [1.0 / (rank + 1)**(1.0 / temperature) for rank in range(len(pruned_candidates))]
                chosen_token = random.choices(pruned_candidates, weights=decay_weights)[0]
                
            response_tokens.append(chosen_token)
            current_state = (current_state[1], chosen_token.lower())
            
            if chosen_token.endswith(('.', '!', '?')):
                break
                
        compiled_sentence = " ".join(response_tokens)
        post_process_audit = preprocess_and_screen(compiled_sentence)
        return post_process_audit["processed_text"] if post_process_audit["status"] == "PASSED" else post_process_audit["output"]
# =====================================================================
# 9. PYTORCH MODEL STRUCTURAL CONFIGURATION
# =====================================================================
class GrapeContextClassifier(nn.Module):
    def __init__(self, vocabulary_size, embedding_dimensions, hidden_neurons, total_output_classes):
        super(GrapeContextClassifier, self).__init__()
        self.embeddings = nn.Embedding(vocabulary_size, embedding_dimensions)
        self.linear1 = nn.Linear(embedding_dimensions, hidden_neurons)
        self.linear2 = nn.Linear(hidden_neurons, total_output_classes)
        self.activation = nn.ReLU()
        
    def forward(self, input_tensor):
        embedded_vectors = self.embeddings(input_tensor)
        averaged_pooling = torch.mean(embedded_vectors, dim=1)
        layer1_output = self.activation(self.linear1(averaged_pooling))
        final_logits = self.linear2(layer1_output)
        return final_logits

# =====================================================================
# 10. RUNTIME INTERACTIVE CHAT ENGINE & AUTOMATED SELF TESTS
# =====================================================================
if __name__ == "__main__":
    ai_engine = GrapeSLMBrain()
    
    print("\n" + "="*70)
    print("         🍇 GRAPE AI SLM PERSISTENT PARAMETER CORE ONLINE 🍇")
    print("="*70)
    
    if not ai_engine.state_matrix:
        print("[System Initialization] Training base vocabulary dependencies...")
        ai_engine.train_on_wikipedia("Grapes")
        ai_engine.train_on_wikipedia("Python (programming language)")
        
    print("\n" + "="*60)
    print(" Live Chat Session Opened. Type text prompts to communicate.")
    print(" Type 'train <topic>' to pull live data updates.")
    print(" Type 'exit' to log out of framework context blocks.")
    print("="*60)
    
    while True:
        try:
            chat_input = input("\nYou: ")
            if chat_input.lower().strip() == 'exit':
                print("Powering down model execution frames. Good bye!")
                break
                
            if chat_input.lower().startswith("train "):
                subject = chat_input[6:].strip()
                if ai_engine.train_on_wikipedia(subject):
                    print(f"Grape AI: Weight parameters successfully processed and tracked inside {PARAMS_FILE}!")
                else:
                    print("Grape AI: Wikipedia processing failed.")
                continue
                
            pipeline_data = preprocess_and_screen(chat_input)
            if pipeline_data["status"] != "PASSED":
                print(pipeline_data["output"])
                continue
                
            bot_reply = ai_engine.inference(pipeline_data["tokens"], temperature=0.7, top_k=4)
            print(f"Grape AI: {bot_reply}")
            
        except KeyboardInterrupt:
            break
