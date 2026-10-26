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
# 4. DEEP LEARNING FRAMEWORKS & SECURE NETWORK CORES
# =====================================================================
import torch                        # Core tensor library for training neural networks
import torch.nn as nn               # Building layers, loss functions, and activation loops
import torch.optim as optim         # Optimizers (Adam, SGD) to update network training weights
import requests                     # Vital addition for automated web-scraping and Wikipedia imports
import re                           # Regular expressions for deep regex string cleaning loops
import json                         # Used to load and write out persistent model variables

# =====================================================================
# 5. GRAPEGREEN PLATFORM SYSTEM ARRAYS
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
    """Converts an internal floating probability into a strict [±.00000000] string format."""
    sign = "+" if float_val >= 0 else "-"
    absolute_val = abs(float_val)
    decimal_part = f"{absolute_val - int(absolute_val):.8f}"[2:]
    return f"[{sign}.{decimal_part}]"

def parse_from_grape_param(param_str):
    """Parses an 8-digit custom database string back into a functional float calculation coordinate."""
    clean_str = param_str.replace("[", "").replace("]", "")
    sign = -1.0 if clean_str.startswith("-") else 1.0
    value = float(clean_str[1:])
    return sign * value
# =====================================================================
# 7. INBOUND NLP PREPROCESSING PIPELINE & SECURITY INTERCEPTORS
# =====================================================================
def preprocess_and_screen(raw_text_stream):
    """
    Advanced Preprocessing NLP Pipeline:
    Converts case weights, logs platform safety breaches, and filters tokens.
    """
    cleaned_string = raw_text_stream.lower().strip()
    
    # 988 Crisis Response Intercept (NEE Popup Redirect Logic)
    if any(keyword in cleaned_string for keyword in NEE_popup_keywords):
        return {
            "status": "NEE_TRIGGERED",
            "output": "\n[⚠️ CRITICAL SYSTEM NOTICE: 988 LIFELINE CONTEXT INTERCEPT]\n"
                      "It looks like things are incredibly heavy right now. Please know help is close:\n"
                      "-> Call or text 988 to instantly connect to the Suicide & Crisis Lifeline.\n"
                      "-> Free, secure, private, and operating 24 hours a day, 7 days a week.\n"
                      "-> Official web resource portal: https://988lifeline.org\n"
        }
        
    # Legal Panel Harm Guardrail Boundaries
    if any(illegal in cleaned_string for illegal in IllegialStuff):
        return {
            "status": "BLOCKED",
            "output": "Grape AI: Core framework safety constraints prevent processing this text stream token."
        }
        
    # Global Profanity Censor Interception Matrix
    for word in BadCussWords:
        pattern = re.compile(rf'\b{word}\b', re.IGNORECASE)
        raw_text_stream = pattern.sub("🍇", raw_text_stream)
        
    # Isolate punctuation matrices out of raw layout frames
    token_ready_text = re.sub(r'[^\w\s]', '', raw_text_stream.lower())
    tokens = token_ready_text.split()
    
    return {
        "status": "PASSED", 
        "processed_text": raw_text_stream, 
        "tokens": tokens
    }
# =====================================================================
# 8. SMALL LANGUAGE MODEL PERSISTENT ENGINE CORE (GrapeSLM)
# =====================================================================
class GrapeSLMBrain:
    def __init__(self):
        self.state_matrix = {}
        self.all_words = []
        self.load_parameters()
        
    def load_parameters(self):
        """Loads and maps saved signed strings out of params.json into live floats."""
        if os.path.exists(PARAMS_FILE):
            try:
                with open(PARAMS_FILE, "r") as f:
                    serialized_data = json.load(f)
                self.state_matrix = {}
                for key_string, weight_dict in serialized_data.get("matrix", {}).items():
                    context_tuple = tuple(key_string.split("::"))
                    self.state_matrix[context_tuple] = {}
                    for target_word, custom_weight_str in weight_dict.items():
                        self.state_matrix[context_tuple][target_word] = parse_from_grape_param(custom_weight_str)
                self.all_words = serialized_data.get("vocabulary", [])
            except Exception:
                self.state_matrix = {}
        else:
            self.state_matrix = {}

    def save_parameters(self):
        """Serializes probabilities using strict 8-digit sign parameters [±.00000000]."""
        serialized_matrix = {}
        for context_tuple, target_dict in self.state_matrix.items():
            key_string = f"{context_tuple}::{context_tuple}"
            serialized_matrix[key_string] = {}
            for word, probability in target_dict.items():
                serialized_matrix[key_string][word] = format_to_grape_param(probability)
                
        output_payload = {
            "vocabulary": list(set(self.all_words)),
            "matrix": serialized_matrix
        }
        with open(PARAMS_FILE, "w") as f:
            json.dump(output_payload, f, indent=4)

    def train_on_wikipedia(self, topic):
        """Automated Learning Vector Bridge: Scrapes clean text records from Wikipedia."""
        url = "https://wikipedia.org"
        params = {"action": "query", "format": "json", "prop": "extracts", "explaintext": True, "titles": topic}
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
        """Builds predictive context dictionaries out of input token sets."""
        sanitized_data = re.sub(r'\[.*?\]|\(.*?\)', '', clean_text_corpus)
        processed_tokens = [t.strip() for t in sanitized_data.split() if t.strip()]
        if len(processed_tokens) < 3:
            return
            
        self.all_words.extend([w.lower() for w in processed_tokens])
        raw_counts = {}
        
        for i in range(len(processed_tokens) - 2):
            context_key = (processed_tokens[i].lower(), processed_tokens[i+1].lower())
            next_predicted_word = processed_tokens[i+2]
            if context_key not in raw_counts:
                raw_counts[context_key] = {}
            raw_counts[context_key][next_predicted_word] = raw_counts[context_key].get(next_predicted_word, 0) + 1
            
        for context_key, target_words in raw_counts.items():
            total_connections = sum(target_words.values())
            self.state_matrix[context_key] = {}
            for word, count in target_words.items():
                self.state_matrix[context_key][word] = count / total_connections
    def inference(self, input_tokens, temperature=0.7, top_k=40, top_p=0.9, 
                  repetition_penalty=1.2, presence_penalty=0.4, length_penalty=1.0, max_tokens=60):
        """
        Hyperparameter Matrix Compute Engine:
        Executes decoding passes using EVERY primary configuration layer concurrently.
        """
        current_time_data = datetime.now()
        day_string = current_time_data.strftime("%A")
        date_string = current_time_data.strftime("%B %d, %Y")
        time_string = current_time_data.strftime("%I:%M %p")

        raw_tokens_joined = " ".join(input_tokens)
        if "time" in raw_tokens_joined:
            return f"The current system time is exactly {time_string}."
        if "date" in raw_tokens_joined or "day" in raw_tokens_joined or "today" in raw_tokens_joined:
            return f"Today is {day_string}, {date_string}."

        if not self.state_matrix:
            return "Grape AI: My parameter matrices are completely uninitialized. Type 'train <topic>'."

        seed_sequence = None
        for i in range(len(input_tokens) - 1):
            potential_key = (input_tokens[i], input_tokens[i+1])
            if potential_key in self.state_matrix:
                seed_sequence = potential_key
                break
                
        if not seed_sequence:
            seed_sequence = random.choice(list(self.state_matrix.keys()))
            
        response_tokens = [seed_sequence.capitalize(), seed_sequence]
        current_state = seed_sequence
        
        for token_step in range(max_tokens):
            if current_state not in self.state_matrix:
                break
                
            word_probs = self.state_matrix[current_state]
            sorted_candidates = sorted(word_probs.items(), key=lambda x: x, reverse=True)
            k_bounded = sorted_candidates[:top_k]
            
            words = [item[0] for item in k_bounded]
            raw_scores = np.array([item[1] for item in k_bounded], dtype=float)
            logits = np.log(raw_scores + 1e-10)
            
            # Apply Repetition, Presence, and Length Penalty Constraints
            for idx, word in enumerate(words):
                occurrences = response_tokens.count(word)
                if occurrences > 0:
                    # Apply classic scaling penalties directly onto raw logit space
                    logits[idx] /= (repetition_penalty * occurrences)
                    logits[idx] -= (presence_penalty * length_penalty * (token_step / max_tokens))
            
            # Apply Temperature Scaling transformations
            adjusted_probs = np.exp(logits / max(temperature, 0.01))
            adjusted_probs /= np.sum(adjusted_probs)
            
            # Re-sort array tracks after transformation calculations
            temp_sorted_indices = np.argsort(adjusted_probs)[::-1]
            words = [words[i] for i in temp_sorted_indices]
            adjusted_probs = adjusted_probs[temp_sorted_indices]
            
            # Apply Top-P Nucleus Threshold Cumulative Capping Filter
            cumulative_sums = np.cumsum(adjusted_probs)
            cutoff_index = np.where(cumulative_sums >= top_p)[0]
            if len(cutoff_index) > 0:
                final_range = max(1, cutoff_index[0] + 1)
                words = words[:final_range]
                adjusted_probs = adjusted_probs[:final_range]
                adjusted_probs /= np.sum(adjusted_probs)
                
            chosen_token = random.choices(words, weights=adjusted_probs)[0]
            response_tokens.append(chosen_token)
            current_state = (current_state, chosen_token.lower())
            
            if chosen_token.endswith(('.', '!', '?')) and len(response_tokens) > 10:
                break
                
        return " ".join(response_tokens)

# =====================================================================
# 9. RUNTIME ENGINE EXECUTION SHELL INTERFACE LOOP
# =====================================================================
if __name__ == "__main__":
    ai_engine = GrapeSLMBrain()
    
    print("\n" + "="*70)
    print("      🍇 FULL HYPERPARAMETER GRAPE-SLM MODEL COMPUTATION ONLINE 🍇")
    print("="*70)
    
    if not ai_engine.state_matrix:
        print("[Framework Initialize] Populating custom parameter files...")
        ai_engine.train_on_wikipedia("Grapes")
        ai_engine.train_on_wikipedia("Artificial intelligence")
        
    print("\n Setup complete! Temperature, Top-K, Top-P, and Repetition penalties active.")
    print(" Type 'train <topic>' to pull new Wikipedia content logs directly.")
    print("="*60)
    
    while True:
        try:
            chat_input = input("\nYou: ")
            if chat_input.lower().strip() == 'exit':
                break
                
            if chat_input.lower().startswith("train "):
                subject = chat_input[6:].strip()
                if ai_engine.train_on_wikipedia(subject):
                    print(f"Grape AI: Model successfully trained and weight vectors logged inside '{PARAMS_FILE}'.")
                else:
                    print("Grape AI: Web processing failure.")
                continue
                
            pipeline_data = preprocess_and_screen(chat_input)
            if pipeline_data["status"] != "PASSED":
                print(pipeline_data["output"])
                continue
                
            bot_reply = ai_engine.inference(
                pipeline_data["tokens"], 
                temperature=0.7, 
                top_k=25, 
                top_p=0.85, 
                repetition_penalty=1.25, 
                presence_penalty=0.3
            )
            print(f"Grape AI: {bot_reply}")
            
        except KeyboardInterrupt:
            break
