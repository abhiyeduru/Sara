import re

def normalize_numbers_to_english(text: str) -> str:
    """
    Ensure all numbers, currency units, times, and BHK configurations
    are represented in standard English digits/words for natural, crisp TTS pronunciation.
    Converts:
    - ౧౨౩ -> 123
    - 85 లక్షలు / 85 లక్షల -> 85 Lakhs
    - 3.5 కోట్లు -> 3.5 Crores
    - 50 వేలు -> 50 Thousand
    - 2 గంటలకు -> 2 PM
    - 2 బీహెచ్కే -> 2 BHK
    """
    if not text:
        return text

    # 1. Translate Telugu digits to ASCII digits
    telugu_digits = str.maketrans('౦౧౨౩౪౫౬౭౮౯', '0123456789')
    text = text.translate(telugu_digits)

    # 2. Convert spelled out Telugu currency/units following numbers to English
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(?:లక్షల|లక్షలు|లక్ష|లక్షలకు|లక్షలకి)', r'\1 Lakhs', text)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(?:కోట్ల|కోట్లు|కోటి|కోట్లకు|కోట్లకి)', r'\1 Crores', text)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*(?:వేల|వేలు|వెయ్యి|వేలకు|వేలకి)', r'\1 Thousand', text)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*Lakhs[ులకికు]?', r'\1 Lakhs', text)
    text = re.sub(r'(\d+(?:\.\d+)?)\s*Crores[ులకికు]?', r'\1 Crores', text)
    text = re.sub(r'(\d+)\s*గంటలకు', r'\1 PM', text)

    text = re.sub(r'(?:రెండు|2)\s*బీహెచ్కే', '2 BHK', text)
    text = re.sub(r'(?:మూడు|3)\s*బీహెచ్కే', '3 BHK', text)
    text = re.sub(r'(?:నాలుగు|4)\s*బీహెచ్కే', '4 BHK', text)
    text = re.sub(r'(\d+)\s*స్క్వేర్\s*ఫీట్', r'\1 Sq Ft', text)

    return text
