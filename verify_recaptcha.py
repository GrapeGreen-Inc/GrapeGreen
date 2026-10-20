import os
import sys
import requests

def check_captcha_token(token):
    # Pull the secret key directly from the GitHub Secrets environment
    secret_key = os.environ.get("RECAPTCHA_SECRET_KEY")
    
    if not secret_key:
        print("[-] Error: RECAPTCHA_SECRET_KEY environment variable is not set!")
        sys.exit(1)
        
    # Prepare the payload for Google's API
    verification_url = "https://google.com"
    payload = {
        'secret': secret_key,
        'response': token
    }
    
    try:
        # Send the secure POST request to Google
        response = requests.post(verification_url, data=payload)
        result = response.json()
        
        # Check if the verification succeeded
        if result.get("success"):
            print("[+] Success: Token is valid!")
            return True
        else:
            print(f"[-] Failed: Invalid token. Error codes: {result.get('error-codes')}")
            return False
            
    except Exception as e:
        print(f"[-] Connection Error: Could not reach Google verification servers. Details: {e}")
        return False

if __name__ == "__main__":
    # This allows you to pass a test token directly from the command line if needed
    # Example: python verify_recaptcha.py MOCK_TOKEN_STRING
    if len(sys.argv) > 1:
        test_token = sys.argv[1]
        check_captcha_token(test_token)
    else:
        print("[-] Usage: Provide a captcha response token to verify.")
