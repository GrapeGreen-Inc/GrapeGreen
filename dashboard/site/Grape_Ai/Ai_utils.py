# GrapeSLM Core Engine with Web Search Integration

# =====================================================================# 1. CORE PYTHON UTILITIES (Math, Randomization, and Time Tracking)# =====================================================================import math                         # For advanced algebraic operations, floats, and constantsimport random                       # For basic random sampling and seeding datasetsimport time                         # For benchmarking model processing performanceimport os                           # For interacting with your database and environment filesimport sys                          # For processing dynamic command line system inputsfrom datetime import datetime       # For tracking explicit user timestamps and log dates
# =====================================================================# 2. NUMERICAL COMPUTATION & DATA ANALYTICS# =====================================================================import numpy as np                  # Core library for vector arrays, matrix math, and tensorsimport pandas as pd                 # For reading datasets, csv strings, and database logs
# =====================================================================# 3. CORE AI, MACHINE LEARNING, & STRUCTURAL NLP# =====================================================================

import sklearn                      # Classic Machine Learning tools (Scikit-Learn)from sklearn.model_selection import train_test_split  # Splits your data sets into training/test partitionsfrom sklearn.preprocessing import LabelEncoder        # Normalizes text tokens into standard index codes
# =====================================================================# 4. DEEP LEARNING FRAMEWORKS & SECURE NETWORK CORES# =====================================================================import torch                        # Core tensor library for training neural networksimport torch.nn as nn               # Building layers, loss functions, and activation loopsimport torch.optim as optim         # Optimizers (Adam, SGD) to update network training weightsimport requests                     # Vital addition for automated web-scraping and Wikipedia importsimport re                           # Regular expressions for deep regex string cleaning loopsimport json                         # Used to load and write out persistent model variables
# =====================================================================# 5. GRAPEGREEN PLATFORM SYSTEM CONFIGURATIONS & ARRAYS# =====================================================================# REQUEST_MODE Guardrail Flags (Hardcoded - Only modifiable in code):# 0 = Turn off requests completely (Offline Mode)

# 1 = Training use active (Allows Wikipedia scraping logs)# 2 = Production use active (Allows Live DDG Searches, Blocks Training modifications)REQUEST_MODE = 1 
parameterSettings = ["mood", "intent", "context", "target", "empathy", "persona"]moods = ["happy", "sad", "angry", "scared", "flirty", "neutral", "disguised", "anxious"]tiers = ["free", "plus", "pro", "max", "owner"]
BadCussWords = ["pussy", "nigger", "nigga", "fuck", "dick", "cock", "bitch", "ass", "asshole", "shit", "crap", "whore"]IllegialStuff = ["hack", "murder", "rape", "theft"]NEE_popup_keywords = ["suiside", "suicide", "kill myself", "end my life", "self harm", "cutting myself", "want to die"]
PARAMS_FILE = "params.json"
# =====================================================================# 6. SIGNED 8-DIGIT FIXED POINT CONVERTER (SERIALIZER)# =====================================================================def format_to_grape_param(float_val):
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
# =====================================================================# 7. INBOUND NLP PREPROCESSING PIPELINE & SECURITY INTERCEPTORS# =====================================================================def preprocess_and_screen(raw_text_stream):
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
# =====================================================================# 8. SMALL LANGUAGE MODEL PERSISTENT ENGINE CORE (GrapeSLM)

# =====================================================================class GrapeSLMBrain:
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
                    parts = key_string.split("::")
                    if len(parts) >= 2:
                        context_tuple = (parts[0], parts[1])
                    else:

                        context_tuple = tuple(parts[0].split(","))
                        
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
            key_string = f"{context_tuple[0]}::{context_tuple[1]}"
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
        """Automated Learning Vector Bridge: Scrapes clean text records from Wikipedia API."""
        if REQUEST_MODE == 0 or REQUEST_MODE == 2:
            return False

        url = "https://en.wikipedia.org/w/api.php"
        params = {
            "action": "query", 
            "format": "json", 
            "prop": "extracts", 
            "explaintext": True, 

            "titles": topic,
            "redirects": 1
        }
        try:
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            pages = data.get("query", {}).get("pages", {})
            text = ""
            for page_id, page_data in pages.items():
                if "extract" in page_data:
                    text += page_data["extract"]
            
            if not text.strip():
                return False
                
            cleaned = re.sub(r'[^\w\s]', '', text.lower())
            words = cleaned.split()
            if len(words) < 3:
                return False

                
            self.all_words.extend(words)
            self.all_words = list(set(self.all_words))
            
            for i in range(len(words) - 2):
                state = (words[i], words[i+1])
                next_word = words[i+2]
                if state not in self.state_matrix:
                    self.state_matrix[state] = {}
                if next_word not in self.state_matrix[state]:
                    self.state_matrix[state][next_word] = 0.0
                self.state_matrix[state][next_word] += 1.0
                
            for state, target_dict in self.state_matrix.items():
                total_sum = sum(target_dict.values())
                for word in target_dict:
                    target_dict[word] /= total_sum
                    
            self.save_parameters()

            return True
        except Exception:
            return False

    def live_duckduckgo_search(self, query):
        """Performs an on-the-fly live web extraction via DuckDuckGo's HTML fallback structure."""
        if REQUEST_MODE == 0 or REQUEST_MODE == 1:
            return "Grape AI Live-Search Warning: Current REQUEST_MODE settings restrict live web operations."

        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        search_url = "https://duckduckgo.com"
        payload = {"q": query}
        try:
            res = requests.post(search_url, data=payload, headers=headers, timeout=10)
            if res.status_code != 200:
                return "Grape AI Live-Search: External search gateway rejected traffic tokens."
            
            snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', res.text, re.DOTALL)
            if not snippets:
                return f"Grape AI Search: No live indexes found for query string token '{query}'."
                
            cleaned_snippets = []
            for snip in snippets[:3]:
                clean_text = re.sub(r'<[^>]*>', '', snip).strip()
                cleaned_snippets.append(clean_text)
                
            joined_context = " | ".join(cleaned_snippets)
            return f"[🌐 Live Search Results for '{query}']: {joined_context}"
        except Exception as e:
            return f"Grape AI Live-Search: Processing failure encountered -> {str(e)}"

    def inference(self, input_tokens, temperature=0.7, top_k=25, top_p=0.85, repetition_penalty=1.25, presence_penalty=0.3, max_tokens=40):
        """Calculates advanced generative tokens by applying statistical logit modification matrices."""
        now = datetime.now()
        time_string = now.strftime("%I:%M:%S %p")
        day_string = now.strftime("%A")

        date_string = now.strftime("%B %d, %Y")

        raw_tokens_joined = " ".join(input_tokens)
        
        if raw_tokens_joined in ["hi", "hello", "hey", "greetings"]:
            return "Grape AI: Hello! I am online and functional. How can I help parse your framework text matrices today?"

        if "search" in raw_tokens_joined or "find out about" in raw_tokens_joined or "website" in raw_tokens_joined:
            search_query = raw_tokens_joined.replace("search", "").replace("website", "").strip()
            if not search_query:
                search_query = "latest web standard updates"
            return self.live_duckduckgo_search(search_query)

        if "time" in raw_tokens_joined:
            return f"The current system time is exactly {time_string}."
        if "date" in raw_tokens_joined or "day" in raw_tokens_joined or "today" in raw_tokens_joined:
            return f"Today is {day_string}, {date_string}."

        if not self.state_matrix:

            self.load_parameters()
            if not self.state_matrix:
                return "Grape AI: My parameter matrices are completely uninitialized inside params.json."

        seed_sequence = None
        for i in range(len(input_tokens) - 1):
            potential_key = (input_tokens[i], input_tokens[i+1])
            if potential_key in self.state_matrix:
                seed_sequence = potential_key
                break
                
        if not seed_sequence:
            if not self.state_matrix.keys():
                return "Grape AI: Matrix empty."
            seed_sequence = random.choice(list(self.state_matrix.keys()))
            
        response_tokens = [seed_sequence[0].capitalize(), seed_sequence[1]]
        current_state = seed_sequence
        

        for token_step in range(max_tokens):
            if current_state not in self.state_matrix:
                break
                
            word_probs = self.state_matrix[current_state]
            sorted_candidates = sorted(word_probs.items(), key=lambda x: x[1], reverse=True)
            k_bounded = sorted_candidates[:top_k]
            
            words = [item[0] for item in k_bounded]
            raw_scores = np.array([item[1] for item in k_bounded], dtype=float)
            logits = np.log(raw_scores + 1e-10)
            
            length_penalty = 1.0
            for idx, word in enumerate(words):
                occurrences = response_tokens.count(word)
                if occurrences > 0:
                    logits[idx] /= (repetition_penalty * occurrences)
                    logits[idx] -= (presence_penalty * length_penalty * (token_step / max_tokens))
            

            adjusted_probs = np.exp(logits / max(temperature, 0.01))
            adjusted_probs /= np.sum(adjusted_probs)
            
            temp_sorted_indices = np.argsort(adjusted_probs)[::-1]
            words = [words[i] for i in temp_sorted_indices]
            adjusted_probs = adjusted_probs[temp_sorted_indices]
            
            cumulative_sums = np.cumsum(adjusted_probs)
            cutoff_index = np.where(cumulative_sums >= top_p)[0]
            if len(cutoff_index) > 0:
                final_range = max(1, cutoff_index[0] + 1)
                words = words[:final_range]
                adjusted_probs = adjusted_probs[:final_range]
                adjusted_probs /= np.sum(adjusted_probs)
                
            chosen_token = random.choices(words, weights=adjusted_probs)[0]
            response_tokens.append(chosen_token)
            
            current_state = (current_state[1], chosen_token.lower())

            
            if chosen_token.endswith(('.', '!', '?')) and len(response_tokens) > 10:
                break
                
        return " ".join(response_tokens)
# =====================================================================# 9. RUNTIME ENGINE EXECUTION SHELL INTERFACE LOOP# =====================================================================if __name__ == "__main__":
    ai_engine = GrapeSLMBrain()
    
    # Optional setup background training if matrix is fully uninitialized
    if not ai_engine.state_matrix and REQUEST_MODE == 1:
        ai_engine.train_on_wikipedia("Grapes")
        ai_engine.train_on_wikipedia("Artificial intelligence")
    
    # Strict execution loop block to prevent early process termination
    while True:

        try:
            chat_input = input("")
            if not chat_input.strip():
                continue
                
            if chat_input.lower().strip() == 'exit':
                break
                
            if chat_input.lower().startswith("train "):
                if REQUEST_MODE != 1:
                    print("Grape AI Check: Training blocked. Switch REQUEST_MODE variable to 1 to write model weights.")
                    continue
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
                top_k=25, top_p=0.85, 
                repetition_penalty=1.25, 
                presence_penalty=0.3
            )
            print(f"Grape AI: {bot_reply}")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            # Fallback block to prevent raw terminal crashes if loops fail
            print(f"Grape AI Runtime Error: {str(e)}")


