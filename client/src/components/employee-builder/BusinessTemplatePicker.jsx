import React from 'react';
import {
  Building2, GraduationCap, Activity, Car,
  Megaphone, ShoppingBag, ShieldCheck, Sparkles
} from 'lucide-react';

export const BUSINESS_TEMPLATES = [
  {
    id: 'hospital',
    title: 'Hospital & clinic',
    icon: Activity,
    badge: 'Popular',
    placeholder: 'e.g. Call patient enquiries, identify symptoms or doctor needed, and book confirmed consultation slot.',
    prompt: 'Call appointment enquiries, identify the requested specialty or doctor, collect preferred consultation times, and confirm the hospital appointment.',
    openingLine: {
      te: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది?',
      en: 'Hello! Am I speaking with {Lead Name}?',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है?'
    },
    variables: ['Phone number', 'Lead Name', 'Doctor Name', 'Preferred Slot', 'Clinic Location'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Booking',
        badge: 'START',
        dialogue: {
          te: 'Introduce yourself as Priya from the healthcare clinic. Say: "నమస్కారం అండి, డాక్టర్ కన్సల్టేషన్ కోసం మీరు అడిగిన వివరాల గురించి కాల్ చేస్తున్నాను." {Preferred Location} {Preferred Slot}',
          en: 'Introduce yourself as Priya from the healthcare clinic. Say: "Hello! Calling regarding the doctor consultation details you enquired about." {Clinic Location} {Preferred Slot}',
          hi: 'हेल्थकेयर क्लिनिक से प्रिया के रूप में परिचय दें: "नमस्ते! आपके द्वारा डॉक्टर अपॉइंटमेंट के बारे में मांगी गई जानकारी के लिए कॉल किया है।" {Clinic Location} {Preferred Slot}'
        }
      },
      {
        step: 2,
        title: '2. Check Symptoms & Urgency',
        dialogue: {
          te: 'Ask what consultation or symptoms they are looking to discuss. Listen carefully and confirm: "మీరు ఏ సమస్య కోసం చెకప్ అనుకుంటున్నారు అండి?"',
          en: 'Ask what consultation or symptoms they are looking to discuss. Listen carefully and confirm: "Could you share the symptoms or medical consultation you need?"',
          hi: 'पूछें कि वे किस समस्या या लक्षण के लिए परामर्श चाहते हैं: "आप किस परेशानी के लिए डॉक्टर को दिखाना चाहते हैं?"'
        }
      },
      {
        step: 3,
        title: '3. Schedule & Confirm Slot',
        dialogue: {
          te: 'Offer available morning or evening slots: "రేపు ఉదయం 11 గంటలకు లేదా సాయంత్రం 5 గంటలకు స్లాట్ ఖాళీగా ఉంది, ఏది మీకు వీలవుతుంది?"',
          en: 'Offer available morning or evening slots: "We have open consultation slots tomorrow at 11 AM or 5 PM. Which suits you best?"',
          hi: 'उपलब्ध सुबह या शाम का समय बताएं: "कल सुबह 11 बजे या शाम 5 बजे का स्लॉट खाली है, आपके लिए कौन सा सही रहेगा?"'
        }
      },
      {
        step: 4,
        title: '4. Send WhatsApp Confirmation',
        dialogue: {
          te: 'Confirm token number, clinic address, and send directions and doctor profile over WhatsApp: "మీ అపాయింట్‌మెంట్ కన్ఫర్మ్ చేశాను. క్లినిక్ లొకేషన్ మరియు టోకెన్ వివరాలు మీ వాట్సాప్ కి పంపిస్తున్నాను. థాంక్యూ అండి!"',
          en: 'Confirm token number, clinic address, and send directions over WhatsApp: "Your appointment is confirmed. I am sending the clinic location pin and token details to your WhatsApp now. Thank you!"',
          hi: 'टोकन नंबर और क्लिनिक का पता कन्फर्म करें: "आपका अपॉइंटमेंट तय हो गया है। क्लिनिक का लोकेशन और टोकन विवरण व्हाट्सऐप पर भेज रही हूँ। धन्यवाद!"'
        }
      }
    ]
  },
  {
    id: 'real-estate',
    title: 'Real estate',
    icon: Building2,
    badge: 'Popular',
    placeholder: 'e.g. Call every new property enquiry from my ad, ask what they need, qualify budget & location, and book a site visit.',
    prompt: 'Call new property enquiries, understand their budget and preferred location, qualify their purchase timeline, and schedule a site visit.',
    openingLine: {
      te: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది? నేను ప్రాపర్టీ అడ్వైజర్ సారా ని.',
      en: 'Hello! Am I speaking with {Lead Name}? This is Sara from the property team.',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है? मैं प्रॉपर्टी एडवाइजर सारा बोल रही हूँ।'
    },
    variables: ['Lead Name', 'Phone number', 'Property Type', 'Preferred Location', 'Budget Range'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Property Enquiry',
        badge: 'START',
        dialogue: {
          te: 'మా ఆఫీస్ నుండి సారా మాట్లాడేది అండి, మీరు గేటెడ్ కమ్యూనిటీ విల్లాల కోసం ఇంక్వైరీ చేశారు కదా అండి? {Property Type} {Preferred Location}',
          en: 'Hi! This is Sara calling regarding your recent enquiry on our gated community villas. {Property Type} {Preferred Location}',
          hi: 'नमस्ते! मैं हमारे नए विला प्रोजेक्ट के संबंध में आपकी हालिया इन्क्वायरी के लिए कॉल कर रही हूँ। {Property Type} {Preferred Location}'
        }
      },
      {
        step: 2,
        title: '2. Qualify BHK, Budget & Location',
        dialogue: {
          te: 'మీరు ఏ ఏరియాలో 2BHK లేదా 3BHK వెతుకుతున్నారో మరియు మీ బడ్జెట్ రేంజ్ ఎంతవరకు అనుకుంటున్నారో చెప్పగలరా అండి? {Budget Range}',
          en: 'Could you share which preferred area and layout (2/3 BHK) you are looking for, and your estimated budget? {Budget Range}',
          hi: 'कृपया बताएं कि आप किस लोकेशन में और कितने बजट में 2/3 BHK विला देख रहे हैं? {Budget Range}'
        }
      },
      {
        step: 3,
        title: '3. Highlight Amenities & Pre-approved Loans',
        dialogue: {
          te: 'మా ప్రాజెక్ట్ 100% వాస్తుతో, RERA అప్రూవల్ మరియు ప్రముఖ బ్యాంకుల నుండి ప్రీ-అప్రూవ్డ్ హోమ్ లోన్స్ తో అందుబాటులో ఉంది.',
          en: 'Our project is 100% RERA approved with premium clubhouse amenities and pre-approved home loan facilities from all major banks.',
          hi: 'हमारा प्रोजेक्ट 100% RERA अप्रूव्ड है और प्रमुख बैंकों से प्री-अप्रूव्ड होम लोन की सुविधा तुरंत उपलब्ध है।'
        }
      },
      {
        step: 4,
        title: '4. Schedule Weekend Site Visit',
        dialogue: {
          te: 'ఈ శనివారం లేదా ఆదివారం ఉదయం సైట్ విజిట్ కి ఎప్పుడు రాగలరో చెప్తారా అండి? మా మేనేజర్ స్వయంగా చూపిస్తారు.',
          en: 'Would this Saturday or Sunday morning work best for a direct site visit? Our project manager will arrange a personalized walkthrough.',
          hi: 'क्या हम इस शनिवार या रविवार को एक साइट विज़िट प्लान कर सकते हैं? हमारे प्रोजेक्ट मैनेजर आपको पूरा प्रोजेक्ट दिखाएंगे।'
        }
      },
      {
        step: 5,
        title: '5. Send WhatsApp Brochure & Location Pin',
        dialogue: {
          te: 'నేను ఇప్పుడే మీ వాట్సాప్ నెంబర్ కి ప్రాజెక్ట్ బ్రోచర్, ఫ్లోర్ ప్లాన్స్ మరియు గూగుల్ లొకేషన్ మ్యాప్ పంపుతున్నాను. థాంక్యూ అండి!',
          en: 'I am sending the complete brochure, floor plans, and Google Maps pin directly to your WhatsApp now. Thank you and have a wonderful day!',
          hi: 'मैंने आपके व्हाट्सऐप पर प्रोजेक्ट ब्रोशर, फ्लोर प्लान और लोकेशन मैप भेज दिया है। धन्यवाद और आपका दिन शुभ हो!'
        }
      }
    ]
  },
  {
    id: 'coaching',
    title: 'Coaching & tuition',
    icon: GraduationCap,
    placeholder: 'e.g. Call student enquiries, understand their target exams or courses, and book a free trial / counselling session.',
    prompt: 'Call course enquiries, understand the student\'s target exam and current class, explain available batches, and schedule a counselling session.',
    openingLine: {
      te: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది? నేను అకాడెమీ నుండి సారా ని.',
      en: 'Hello! Am I speaking with {Lead Name}? This is Sara from the Academy.',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है? मैं एकेडमी से सारा हूँ।'
    },
    variables: ['Lead Name', 'Phone number', 'Student Name', 'Target Exam', 'Preferred Batch'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Course Enquiry',
        badge: 'START',
        dialogue: {
          te: 'నమస్కారం అండి! మీరు మా ఆన్‌లైన్/ఆఫ్‌లైన్ కోచింగ్ ప్రోగ్రామ్ గురించి వివరాలు అడిగారు కదా, సహాయం చేయడానికి కాల్ చేశాను. {Target Exam}',
          en: 'Hello! Calling regarding the course curriculum and admissions information you requested for {Target Exam}.',
          hi: 'नमस्ते! आपने {Target Exam} की कोचिंग के लिए जानकारी माँगी थी, उसी के लिए कॉल किया है।'
        }
      },
      {
        step: 2,
        title: '2. Understand Target Exam & Standard',
        dialogue: {
          te: 'స్టూడెంట్ ప్రస్తుతం ఏ క్లాస్ చదువుతున్నారు అండి? ఏ కాంపిటేటివ్ ఎగ్జామ్ కి ప్రిపేర్ అవ్వాలనుకుంటున్నారు?',
          en: 'Which standard is the student currently in, and which competitive entrance exam is their primary goal?',
          hi: 'विद्यार्थी अभी किस कक्षा में है और किस प्रतियोगी परीक्षा की तैयारी का लक्ष्य है?'
        }
      },
      {
        step: 3,
        title: '3. Highlight Faculty & Scholarships',
        dialogue: {
          te: 'మా దగ్గర టాప్ ఫ్యాకల్టీతో పాటు డయాగ్నోస్టిక్ స్కాలర్‌షిప్ టెస్ట్ ద్వారా ఫీజులో 30% వరకు రాయితీ లభిస్తుంది.',
          en: 'We offer senior IIT/AIIMS mentor faculty and up to 30% merit scholarship based on our diagnostic test.',
          hi: 'हमारे पास वरिष्ठ मेंटर्स की टीम है और स्कॉलरशिप टेस्ट के जरिए फीस में 30% तक की छूट मिल सकती है।'
        }
      },
      {
        step: 4,
        title: '4. Book Free Demo Class / Counselling',
        dialogue: {
          te: 'రేపు సాయంత్రం 5 గంటలకు ఫ్రీ డెమో క్లాస్ లేదా కౌన్సెలింగ్ సెషన్ ఫిక్స్ చేద్దామా అండి?',
          en: 'Can we schedule a complimentary demo class and 1-on-1 expert counselling session for tomorrow at 5 PM?',
          hi: 'क्या कल शाम 5 बजे के लिए एक फ्री डेमो क्लास या काउंसलिंग सेशन बुक करें?'
        }
      },
      {
        step: 5,
        title: '5. Dispatch Syllabus & Link via WhatsApp',
        dialogue: {
          te: 'సిలబస్ బ్రోచర్ మరియు జూమ్ క్లాస్ లింక్ మీ వాట్సాప్ కి పంపించాను అండి. ధన్యవాదాలు!',
          en: 'I have dispatched the complete syllabus schedule and demo joining link to your WhatsApp. Have a great day!',
          hi: 'सिलेबस और डेमो क्लास लिंक आपके व्हाट्सऐप पर भेज दिया गया है। धन्यवाद!'
        }
      }
    ]
  },
  {
    id: 'dealership',
    title: 'Car & bike dealership',
    icon: Car,
    placeholder: 'e.g. Call test drive leads, ask about model and budget, and schedule an exclusive showroom test drive.',
    prompt: 'Call vehicle enquiries, understand the customer\'s budget and preferred model, qualify purchase timeline, and schedule a test drive visit.',
    openingLine: {
      te: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది? నేను ఆటోమోటివ్ షోరూమ్ నుండి మాట్లాడుతున్నాను.',
      en: 'Hello! Am I speaking with {Lead Name}? Calling from the automotive showroom.',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है? मैं ऑटोमोटिव शोरूम से बोल रही हूँ।'
    },
    variables: ['Lead Name', 'Phone number', 'Vehicle Model', 'Fuel Type', 'Test Drive Slot'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Test Drive Request',
        badge: 'START',
        dialogue: {
          te: 'నమస్కారం అండి! మీరు మా సరికొత్త మోడల్ టెస్ట్ డ్రైవ్ గురించి ఎంక్వైరీ చేశారు కదా! {Vehicle Model}',
          en: 'Hello! Calling regarding your test drive inquiry for our latest vehicle lineup. {Vehicle Model}',
          hi: 'नमस्ते! आपने हमारी नई गाड़ी की टेस्ट ड्राइव के लिए इन्क्वायरी की थी। {Vehicle Model}'
        }
      },
      {
        step: 2,
        title: '2. Qualify Variant & Fuel Preference',
        dialogue: {
          te: 'మీరు ఏ వేరియంట్ మరియు కలర్ ఆప్షన్ చూస్తున్నారు అండి? పెట్రోల్ లేదా ఎలక్ట్రిక్ (EV) మోడల్ లో ఆసక్తి ఉందా? {Fuel Type}',
          en: 'Which variant and fuel type are you most interested in—petrol, hybrid, or EV? {Fuel Type}',
          hi: 'आप किस वैरिएंट और फ्यूल टाइप में रुचि रखते हैं—पेट्रोल या इलेक्ट्रिक? {Fuel Type}'
        }
      },
      {
        step: 3,
        title: '3. Present Exchange Bonus & EMI Offers',
        dialogue: {
          te: 'మీ ప్రస్తుత వాహనాన్ని ఎక్స్ఛేంజ్ చేయాలనుకుంటున్నారా? మా దగ్గర ఆకర్షణీయమైన ఎక్స్ఛేంజ్ బోనస్ మరియు లో-ఇంట్రెస్ట్ EMI ఆప్షన్స్ ఉన్నాయి.',
          en: 'Do you have an existing vehicle you would like to exchange? We are offering an exclusive exchange bonus and flexible EMI plans.',
          hi: 'क्या आप अपनी पुरानी गाड़ी एक्सचेंज करना चाहते हैं? हमारे पास स्पेशल एक्सचेंज बोनस और कम ब्याज दर EMI मौजूद है।'
        }
      },
      {
        step: 4,
        title: '4. Lock Doorstep or Showroom Test Drive',
        dialogue: {
          te: 'ఈ వీకెండ్ టెస్ట్ డ్రైవ్ షోరూమ్ లో ప్లాన్ చేద్దామా లేక మీ ఇంటి వద్దకే మా ఎగ్జిక్యూటివ్ కారు తీసుకురావాలా అండి?',
          en: 'Would you like to experience the test drive at our showroom this weekend, or would you prefer a complimentary doorstep test drive?',
          hi: 'क्या इस वीकेंड टेस्ट ड्राइव के लिए शोकेस रूम आएंगे या हम गाड़ी आपके घर पर भेजें?'
        }
      },
      {
        step: 5,
        title: '5. Send On-road Price on WhatsApp',
        dialogue: {
          te: 'ఆన్-రోడ్ ప్రైస్ బ్రేకప్ మరియు ఫీచర్ బ్రోచర్ మీ వాట్సాప్ కి పంపించాను. థాంక్యూ అండి!',
          en: 'I have dispatched the on-road price quotation and feature brochure to your WhatsApp. Looking forward to your drive!',
          hi: 'ऑन-रोड कीमत और ब्रोशर आपके व्हाट्सऐप पर भेज दिया गया है। धन्यवाद!'
        }
      }
    ]
  },
  {
    id: 'marketing',
    title: 'Digital marketing',
    icon: Megaphone,
    placeholder: 'e.g. Call agency leads, understand their current ad budget and growth goals, and schedule a free audit call.',
    prompt: 'Follow up with marketing enquiries, understand their current business growth challenges, present tailored agency packages, and book an audit call.',
    openingLine: {
      te: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది? గ్రోత్ మార్కెటింగ్ నుండి సారా ని.',
      en: 'Hello! Am I speaking with {Lead Name}? This is Sara from Growth Marketing.',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है? मैं ग्रोथ मार्केटिंग से सारा हूँ।'
    },
    variables: ['Lead Name', 'Phone number', 'Company Name', 'Monthly Budget', 'Growth Goal'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Growth Enquiry',
        badge: 'START',
        dialogue: {
          te: 'నమస్కారం అండి! మీ వ్యాపారం కోసం లీడ్స్ మరియు సేల్స్ పెంచే స్ట్రాటజీ గురించి మాట్లాడటానికి కాల్ చేశాను. {Company Name}',
          en: 'Hi there! Calling regarding scaling qualified customer leads and sales pipeline for {Company Name}.',
          hi: 'नमस्ते! आपके व्यवसाय के लिए कस्टमर लीड्स और सेल्स बढ़ाने पर चर्चा करने के लिए कॉल किया है। {Company Name}'
        }
      },
      {
        step: 2,
        title: '2. Channel & Current Budget Audit',
        dialogue: {
          te: 'ప్రస్తుతం మీ బిజినెస్ కి ప్రధానంగా ఏ ఛానల్ ద్వారా లీడ్స్ వస్తున్నాయి? మెటా యాడ్స్ లేదా గూగుల్ యాడ్స్ రన్ చేస్తున్నారా? {Monthly Budget}',
          en: 'Which customer acquisition channels are currently active for you—Meta Ads, Google Search, or organic inbound? {Monthly Budget}',
          hi: 'वर्तमान में आप कस्टमर्स तक कैसे पहुँच रहे हैं? क्या आप फेसबुक/इंस्टाग्राम या गूगल एड्स चला रहे हैं? {Monthly Budget}'
        }
      },
      {
        step: 3,
        title: '3. Highlight Verified Case Study & ROAS',
        dialogue: {
          te: 'మా క్లయింట్స్ కి సగటున 3.5 రెట్లు ఎక్కువ ROAS మరియు లీడ్ కాస్ట్ 40% తగ్గించాము.',
          en: 'We routinely deliver 3.5x+ ROAS while reducing cost per qualified acquisition by over 40%.',
          hi: 'हमने समान व्यवसायों के लिए विज्ञापन खर्च पर 3.5 गुना रिटर्न और कम लागत में उच्च गुणवत्ता वाले ग्राहक दिए हैं।'
        }
      },
      {
        step: 4,
        title: '4. Book 1-on-1 Growth Audit Session',
        dialogue: {
          te: 'రేపు మధ్యాహ్నం 3 గంటలకు మన సీనియర్ స్ట్రాటజిస్ట్‌తో 20 నిమిషాల ఫ్రీ గ్రోత్ ఆడిట్ కాల్ బుక్ చేద్దామా?',
          en: 'Can we schedule a focused 20-minute growth roadmap session with our lead strategist tomorrow at 3 PM?',
          hi: 'क्या कल दोपहर 3 बजे हमारे सीनियर स्ट्रैटेजिस्ट के साथ 20 मिनट का फ्री ग्रोथ ऑडिट कॉल रखें?'
        }
      },
      {
        step: 5,
        title: '5. Send Calendar Link on WhatsApp',
        dialogue: {
          te: 'క్యాలెండర్ ఇన్వైట్ మరియు కేస్ స్టడీ వివరాలు మీ వాట్సాప్ కి పంపాను. థాంక్యూ!',
          en: 'Calendar invite and case study deck sent to your WhatsApp. Talk soon!',
          hi: 'कैलेंडर इनवाइट और केस स्टडी व्हाट्सऐप पर भेज दी गई है। धन्यवाद!'
        }
      }
    ]
  },
  {
    id: 'ecommerce',
    title: 'E-commerce',
    icon: ShoppingBag,
    placeholder: 'e.g. Follow up on abandoned carts, offer special 10% coupon, and assist order completion.',
    prompt: 'Call customers regarding abandoned checkouts, offer assistance and exclusive limited-time discounts, and confirm order placement.',
    openingLine: {
      te: 'హలో అండి, {Lead Name} గారేనా మాట్లాడేది? నేను కస్టమర్ సపోర్ట్ నుండి సారా ని.',
      en: 'Hello! Am I speaking with {Lead Name}? This is Sara from Customer Support.',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है? मैं कस्टमर सपोर्ट से सारा हूँ।'
    },
    variables: ['Lead Name', 'Phone number', 'Cart Item', 'Discount Code', 'Delivery City'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Incomplete Order',
        badge: 'START',
        dialogue: {
          te: 'హలో అండి! మీరు మా వెబ్‌సైట్‌లో ఒక ఐటమ్ సెలెక్ట్ చేసుకున్నారు కదా, చెక్-అవుట్ లో ఏమైనా సమస్య ఎదురైందా అని తెలుసుకోవడానికి కాల్ చేశాను. {Cart Item}',
          en: 'Hello! I noticed you left an item in your shopping bag, and wanted to see if you ran into any payment issues. {Cart Item}',
          hi: 'नमस्ते! आपकी कार्ट में कुछ सामान अधूरा रह गया था, क्या चेकआउट में कोई परेशानी हुई? {Cart Item}'
        }
      },
      {
        step: 2,
        title: '2. Offer Exclusive 10% Savings Code',
        dialogue: {
          te: 'మీ కోసం ప్రత్యేకంగా 10% అదనపు డిస్కౌంట్ మరియు ఫ్రీ డెలివరీ కూపన్ యాక్టివేట్ చేశాను: {Discount Code}',
          en: 'I have unlocked an exclusive 10% savings coupon plus complimentary express shipping for you: {Discount Code}',
          hi: 'आपके लिए विशेष 10% अतिरिक्त छूट और फ्री डिलीवरी तुरंत लागू कर दी गई है: {Discount Code}'
        }
      },
      {
        step: 3,
        title: '3. Offer COD or 1-Click UPI Payment',
        dialogue: {
          te: 'మీకు క్యాష్ ఆన్ డెలివరీ (COD) లేదా డైరెక్ట్ UPI పేమెంట్ లింక్ సౌకర్యం కావాలా అండి?',
          en: 'Would you prefer Cash on Delivery (COD) or a 1-click UPI checkout link?',
          hi: 'क्या आप कैश ऑन डिलीवरी (COD) चुनना चाहेंगे या UPI पेमेंट लिंक भेज दूँ?'
        }
      },
      {
        step: 4,
        title: '4. Confirm Order Placement & Delivery',
        dialogue: {
          te: 'సరే అండి! మీ ఆర్డర్ ప్రాసెస్ చేస్తున్నాను, 3 రోజుల్లో మీ చిరునామాకు డెలివరీ అవుతుంది.',
          en: 'Great! Your order is being prioritized and will arrive within 3 business days to your doorstep.',
          hi: 'आपका ऑर्डर कन्फर्म हो गया है, 3 दिनों में डिलीवर हो जाएगा।'
        }
      },
      {
        step: 5,
        title: '5. Send Live Tracking via WhatsApp',
        dialogue: {
          te: 'లైవ్ ట్రాకింగ్ లింక్ మరియు ఆర్డర్ రసీదు మీ వాట్సాప్ కి పంపించాను. థాంక్యూ!',
          en: 'Your live tracking link and order receipt have been sent to WhatsApp. Thank you!',
          hi: 'लाइव ट्रैकिंग लिंक आपके व्हाट्सऐप पर भेज दिया गया है। धन्यवाद!'
        }
      }
    ]
  },
  {
    id: 'finance',
    title: 'Finance & insurance',
    icon: ShieldCheck,
    placeholder: 'e.g. Reach out to loan or policy leads, collect requirements, and book senior advisor consultation.',
    prompt: 'Reach out to policy enquiries, understand insurance requirements, explain plan benefits clearly, and schedule a financial advisor call.',
    openingLine: {
      te: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది? ఫైనాన్షియల్ సర్వీసెస్ నుండి సారా ని.',
      en: 'Hello! Am I speaking with {Lead Name}? This is Sara from Financial Services.',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है? मैं फाइनेंशियल सर्विसेज से सारा हूँ।'
    },
    variables: ['Lead Name', 'Phone number', 'Loan Type', 'Required Amount', 'Employment Type'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Financial Enquiry',
        badge: 'START',
        dialogue: {
          te: 'నమస్కారం అండి! మీరు లోన్ / ఇన్సూరెన్స్ ప్లాన్ గురించి విచారించారు కదా, వివరాలు పంచుకోవడానికి కాల్ చేశాను. {Loan Type}',
          en: 'Hello! Calling regarding your recent loan or wealth protection inquiry. {Loan Type}',
          hi: 'नमस्ते! आपने लोन या बीमा योजना के बारे में जानकारी माँगी थी, उसी के लिए कॉल किया है। {Loan Type}'
        }
      },
      {
        step: 2,
        title: '2. Qualify Amount & Employment Status',
        dialogue: {
          te: 'మీకు అవసరమైన మొత్తం ఎంతవరకు ఉంది అండి? అలాగే మీరు ఉద్యోగిగానా లేదా సొంత వ్యాపారం చేస్తున్నారా? {Required Amount}',
          en: 'What coverage amount or loan requirement are you considering? And are you salaried or self-employed? {Required Amount}',
          hi: 'आपको कितनी राशि की आवश्यकता है? और क्या आप वेतनभोगी हैं या स्वरोजगार करते हैं? {Required Amount}'
        }
      },
      {
        step: 3,
        title: '3. Highlight Low Interest Rate & Tax Savings',
        dialogue: {
          te: 'మా వద్ద తక్కువ వడ్డీ రేటుతో పాటు సెక్షన్ 80C కింద పన్ను ఆదా ప్రయోజనాలు కూడా ఉన్నాయి.',
          en: 'We offer competitive interest rates starting at 8.4% along with significant Section 80C tax benefits.',
          hi: 'हमारे पास सबसे कम ब्याज दर और आयकर छूट के बेहतरीन लाभ उपलब्ध हैं।'
        }
      },
      {
        step: 4,
        title: '4. Book Senior Financial Advisor Call',
        dialogue: {
          te: 'ఈ రోజు సాయంత్రం 5 గంటలకు మా సీనియర్ అడ్వైజర్ తో 10 నిమిషాల కన్సల్టేషన్ ఫిక్స్ చేయమంటారా?',
          en: 'May I book a 10-minute confidential consultation with our certified financial planner this evening at 5 PM?',
          hi: 'क्या आज शाम 5 बजे हमारे सीनियर वित्तीय सलाहकार के साथ 10 मिनट की कॉल बुक करें?'
        }
      },
      {
        step: 5,
        title: '5. Dispatch Checklist on WhatsApp',
        dialogue: {
          te: 'డాక్యుమెంట్ చెక్‌లిస్ట్ మరియు అర్హత వివరాలు మీ వాట్సాప్ కి పంపించాను. థాంక్యూ!',
          en: 'Document checklist and eligibility summary sent to your WhatsApp. Have a great day!',
          hi: 'दस्तावेज़ सूची और विवरण व्हाट्सऐप पर भेज दिए हैं। धन्यवाद!'
        }
      }
    ]
  },
  {
    id: 'custom',
    title: 'Custom business',
    icon: Sparkles,
    badge: 'Flexible',
    placeholder: 'e.g. Describe what your company does and how the AI employee should handle customer calls.',
    prompt: 'Greet callers politely, understand what they need, answer business service questions, and qualify them for a direct meeting.',
    openingLine: {
      te: 'నమస్కారం అండి, {Lead Name} గారేనా మాట్లాడేది? నేను మీ అసిస్టెంట్ సారా మాట్లాడుతున్నాను.',
      en: 'Hello! Am I speaking with {Lead Name}? This is Sara, your assistant.',
      hi: 'नमस्ते! क्या मेरी बात {Lead Name} जी से हो रही है? मैं आपकी सहायक सारा बोल रही हूँ।'
    },
    variables: ['Lead Name', 'Phone number', 'Service Required', 'Preferred Timing'],
    scriptStages: [
      {
        step: 1,
        title: '1. Greet & Reference Enquiry',
        badge: 'START',
        dialogue: {
          te: 'నమస్కారం అండి! మీరు మా సేవల గురించి తెలుసుకోవడానికి రిక్వెస్ట్ చేశారు కదా, వివరాలు పంచుకోవడానికి కాల్ చేశాను.',
          en: 'Hello! Calling regarding your enquiry about our services and solutions.',
          hi: 'नमस्ते! आपने हमारी सेवाओं के बारे में जानकारी माँगी थी, उसी के लिए कॉल किया है।'
        }
      },
      {
        step: 2,
        title: '2. Understand Requirements & Timeline',
        dialogue: {
          te: 'మీకు ప్రస్తుత అవసరం ఏమిటి మరియు ఎంత త్వరగా ప్రారంభించాలనుకుంటున్నారు చెప్పగలరా? {Service Required}',
          en: 'Could you share what specific services you need and your target timeline? {Service Required}',
          hi: 'आपकी मुख्य आवश्यकता क्या है और आप कब से शुरू करना चाहते हैं? {Service Required}'
        }
      },
      {
        step: 3,
        title: '3. Present Tailored Service Offering',
        dialogue: {
          te: 'మీ అవసరానికి తగ్గట్టుగా మా వద్ద అనుకూలమైన ప్యాకేజీలు మరియు డెడికేటెడ్ సపోర్ట్ అందుబాటులో ఉన్నాయి.',
          en: 'We have tailored packages designed specifically to address your exact requirements.',
          hi: 'आपकी जरूरत के हिसाब से हमारे पास सबसे उपयुक्त समाधान मौजूद है।'
        }
      },
      {
        step: 4,
        title: '4. Lock Strategy Meeting Slot',
        dialogue: {
          te: 'రేపు ఉదయం 11 గంటలకు మన టీమ్ తో డీటైల్డ్ డిస్కషన్ ప్లాన్ చేద్దామా అండి? {Preferred Timing}',
          en: 'Would tomorrow at 11 AM work well for a detailed discussion with our team? {Preferred Timing}',
          hi: 'क्या कल सुबह 11 बजे टीम के साथ विस्तृत चर्चा के लिए समय तय करें? {Preferred Timing}'
        }
      },
      {
        step: 5,
        title: '5. Send Confirmation via WhatsApp',
        dialogue: {
          te: 'వివరాలు మరియు మీటింగ్ సమయం మీ వాట్సాప్ కి పంపించాను. థాంక్యూ అండి!',
          en: 'Complete summary and appointment details sent to your WhatsApp. Thank you!',
          hi: 'सभी विवरण और समय व्हाट्सऐप पर भेज दिया गया है। धन्यवाद!'
        }
      }
    ]
  }
];

export default function BusinessTemplatePicker({ selectedTemplateId, onSelectTemplate }) {
  return (
    <div className="template-picker-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#7c3aed',
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}
          >
            Quick Template Starters
          </span>
          <span
            style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#6d28d9',
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 12
            }}
          >
            Auto-prepares call script
          </span>
        </div>
        <span style={{ fontSize: 11.5, color: '#64748b' }}>
          Select industry to load tailored script & variables
        </span>
      </div>

      <div
        className="template-chips-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'thin'
        }}
      >
        {BUSINESS_TEMPLATES.map((tmpl) => {
          const isActive = selectedTemplateId === tmpl.id;
          const Icon = tmpl.icon;

          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectTemplate(tmpl)}
              className={`template-chip ${isActive ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                background: isActive ? '#f5f3ff' : '#ffffff',
                border: isActive ? '1.5px solid #7c3aed' : '1px solid #e2e8f0',
                color: isActive ? '#6d28d9' : '#334155',
                fontSize: 12.5,
                fontWeight: isActive ? 700 : 500,
                boxShadow: isActive
                  ? '0 3px 12px rgba(124, 58, 237, 0.12)'
                  : '0 1px 3px rgba(0, 0, 0, 0.03)',
                whiteSpace: 'nowrap',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.background = '#ffffff';
                }
              }}
            >
              <Icon
                size={14}
                color={isActive ? '#7c3aed' : '#64748b'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{tmpl.title}</span>
              {tmpl.badge && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: isActive ? '#7c3aed' : '#e0e7ff',
                    color: isActive ? '#ffffff' : '#4338ca',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  {tmpl.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
