"""Exercícios do módulo 'Destravar a Fala' e de shadowing (inglês)."""

from __future__ import annotations

# Quick Response Training: perguntas curtas; `keywords` orientam a verificação de relevância no modo offline.
QUICK_RESPONSE_EN: list[dict] = [
    {"id": "qr-a2-1", "level": "A2", "theme": "personal", "q": "What do you do for a living?", "keywords": ["engineer", "work", "job", "i am", "i'm", "developer", "manager", "analyst", "technician"], "model": "I'm a mechanical engineer. I work on product design."},
    {"id": "qr-a2-2", "level": "A2", "theme": "personal", "q": "Where are you from?", "keywords": ["brazil", "from", "city"], "model": "I'm from Brazil, from a city near São Paulo."},
    {"id": "qr-a2-3", "level": "A2", "theme": "daily", "q": "What time do you usually start work?", "keywords": ["at", "o'clock", "morning", "am", "start", "usually"], "model": "I usually start at eight in the morning."},
    {"id": "qr-a2-4", "level": "A2", "theme": "daily", "q": "What did you have for breakfast today?", "keywords": ["had", "ate", "coffee", "bread", "breakfast", "didn't"], "model": "I had coffee and some bread with cheese."},
    {"id": "qr-a2-5", "level": "A2", "theme": "travel", "q": "Have you ever been to the United States?", "keywords": ["yes", "no", "never", "been", "went", "once", "times"], "model": "Yes, I've been there once, to Chicago, for a training."},
    {"id": "qr-a2-6", "level": "A2", "theme": "travel", "q": "Do you prefer the window or the aisle seat?", "keywords": ["window", "aisle", "prefer", "because"], "model": "I prefer the aisle, because I can stand up more easily."},
    {"id": "qr-b1-1", "level": "B1", "theme": "work", "q": "What are you working on this week?", "keywords": ["working", "project", "on", "drawing", "design", "meeting", "report", "testing"], "model": "This week I'm working on the new bracket design and updating the BOM."},
    {"id": "qr-b1-2", "level": "B1", "theme": "work", "q": "What's the most difficult part of your job?", "keywords": ["difficult", "hard", "challenge", "because", "deadlines", "part"], "model": "The hardest part is dealing with tight deadlines and changing requirements."},
    {"id": "qr-b1-3", "level": "B1", "theme": "work", "q": "How long have you been at your company?", "keywords": ["for", "since", "years", "been", "months"], "model": "I've been at my company for about six years."},
    {"id": "qr-b1-4", "level": "B1", "theme": "opinion", "q": "Do you prefer working from home or at the office? Why?", "keywords": ["prefer", "home", "office", "because", "depends"], "model": "It depends, but I prefer the office for meetings because it's easier to discuss drawings."},
    {"id": "qr-b1-5", "level": "B1", "theme": "travel", "q": "What would you do if your luggage didn't arrive?", "keywords": ["would", "go", "ask", "desk", "report", "airline", "lost"], "model": "I would go to the airline desk and file a report."},
    {"id": "qr-b1-6", "level": "B1", "theme": "work", "q": "Can you describe your team in two sentences?", "keywords": ["team", "people", "we", "engineers", "are"], "model": "We're a team of five engineers. We design and standardize components."},
    {"id": "qr-b1-7", "level": "B1", "theme": "daily", "q": "What did you do last weekend?", "keywords": ["went", "stayed", "watched", "visited", "played", "did", "last"], "model": "I stayed home on Saturday and went to a barbecue on Sunday."},
    {"id": "qr-b1-8", "level": "B1", "theme": "work", "q": "What software do you use the most at work?", "keywords": ["use", "solidworks", "sap", "excel", "cad", "software", "most"], "model": "I mostly use SolidWorks and SAP, and of course Excel."},
    {"id": "qr-b2-1", "level": "B2", "theme": "work", "q": "If your project were delayed by two weeks, how would you tell your manager?", "keywords": ["would", "explain", "tell", "plan", "delay", "because", "propose"], "model": "I'd explain the reason, show the impact, and propose a recovery plan right away."},
    {"id": "qr-b2-2", "level": "B2", "theme": "opinion", "q": "What's one thing your company should change, and why?", "keywords": ["should", "because", "change", "think", "would"], "model": "I think we should standardize our components, because we have too many similar parts."},
    {"id": "qr-b2-3", "level": "B2", "theme": "work", "q": "How do you usually handle disagreements in meetings?", "keywords": ["usually", "listen", "try", "agree", "data", "understand", "point"], "model": "I try to understand their point first, and then I use data to support my view."},
    {"id": "qr-b2-4", "level": "B2", "theme": "work", "q": "What's a mistake you made at work and what did you learn from it?", "keywords": ["mistake", "learned", "made", "once", "since then", "now"], "model": "I once released a drawing without checking the revision. Since then, I always double-check."},
    {"id": "qr-b2-5", "level": "B2", "theme": "opinion", "q": "Is AI going to change your job? How?", "keywords": ["think", "will", "change", "ai", "probably", "help", "automate"], "model": "I think it will automate routine tasks, like documentation, so we can focus on design."},
    {"id": "qr-b2-6", "level": "B2", "theme": "work", "q": "How would you explain what a BOM is to someone who isn't an engineer?", "keywords": ["list", "parts", "components", "product", "need", "like"], "model": "It's like a recipe: a list of all the parts and quantities you need to build a product."},
    {"id": "qr-c1-1", "level": "C1", "theme": "opinion", "q": "What are the trade-offs of standardizing components across product lines?", "keywords": ["trade-off", "cost", "flexibility", "inventory", "however", "on the other hand", "but"], "model": "You cut inventory and cost, but you lose some design flexibility and may over-spec some products."},
    {"id": "qr-c1-2", "level": "C1", "theme": "work", "q": "How would you convince a skeptical plant manager to adopt a new process?", "keywords": ["show", "data", "pilot", "benefit", "would", "concerns", "risk"], "model": "I'd start with a small pilot, show the data from their own line, and address their concerns openly."},
]

# Sentence Building: estágios progressivos (ordenar blocos → expandir → resposta livre).
SENTENCE_BUILDING_EN: list[dict] = [
    {"id": "sb-1", "level": "A2", "stage": "order", "situation_pt": "Pedir para alguém repetir", "chunks": ["Could", "you", "say", "that", "again", "please?"], "answer": "Could you say that again please?"},
    {"id": "sb-2", "level": "A2", "stage": "order", "situation_pt": "Dizer há quanto tempo trabalha na empresa", "chunks": ["I've", "worked", "here", "for", "six", "years."], "answer": "I've worked here for six years."},
    {"id": "sb-3", "level": "B1", "stage": "order", "situation_pt": "Dizer que vai verificar e retornar", "chunks": ["I'll", "look", "into", "it", "and", "get back", "to you."], "answer": "I'll look into it and get back to you."},
    {"id": "sb-4", "level": "B1", "stage": "order", "situation_pt": "Pedir mais prazo educadamente", "chunks": ["Would", "it be", "possible", "to extend", "the deadline", "by a week?"], "answer": "Would it be possible to extend the deadline by a week?"},
    {"id": "sb-5", "level": "B2", "stage": "order", "situation_pt": "Explicar a hipótese de causa raiz", "chunks": ["Our", "working hypothesis", "is that", "the connector", "is overheating."], "answer": "Our working hypothesis is that the connector is overheating."},
    {"id": "sb-6", "level": "B1", "stage": "expand", "situation_pt": "Expanda a frase adicionando QUANDO e POR QUÊ", "base": "We need to change the supplier.", "add": ["when (quando)", "because (por quê)"], "example": "We need to change the supplier next quarter because their lead time is too long."},
    {"id": "sb-7", "level": "B1", "stage": "expand", "situation_pt": "Expanda adicionando um CONTRASTE (but / however)", "base": "The new design is lighter.", "add": ["but / however"], "example": "The new design is lighter, but it's more expensive to machine."},
    {"id": "sb-8", "level": "B2", "stage": "expand", "situation_pt": "Expanda adicionando uma CONDIÇÃO (if / provided that)", "base": "We can deliver on the 15th.", "add": ["if / provided that"], "example": "We can deliver on the 15th, provided that we get the PO this week."},
    {"id": "sb-9", "level": "B2", "stage": "expand", "situation_pt": "Expanda adicionando IMPACTO e PRÓXIMO PASSO", "base": "The press stopped twice today.", "add": ["impact", "next step"], "example": "The press stopped twice today, which cost us about an hour, so we're replacing the sensor tonight."},
    {"id": "sb-10", "level": "B1", "stage": "free", "situation_pt": "Seu voo atrasou e você vai perder a reunião. Escreva/fale a mensagem para o colega.", "example": "Hi Laura, my flight is delayed by three hours, so I'm going to miss the 9 a.m. meeting. Could we move it to the afternoon?"},
    {"id": "sb-11", "level": "B2", "stage": "free", "situation_pt": "Explique a um colega estrangeiro por que a peça precisa de uma nova revisão do desenho.", "example": "We need a new revision because the hole position changed after the tolerance analysis, and the current drawing doesn't reflect that."},
    {"id": "sb-12", "level": "B2", "stage": "free", "situation_pt": "Discorde educadamente de uma proposta de reduzir o tempo de validação.", "example": "I see why we want to save time, but cutting validation to one week is risky. What if we prioritize the critical tests instead?"},
]

# Think in English: formulação direta, circunlocução e auto-fala — sem tradução.
THINK_IN_ENGLISH_EN: list[dict] = [
    {"id": "tie-1", "type": "describe_scene", "level": "A2", "prompt": "Describe your workspace right now in 4 sentences. What can you see?", "seconds": 45},
    {"id": "tie-2", "type": "describe_scene", "level": "B1", "prompt": "Picture a busy airport gate: a delayed flight, people waiting, an announcement. Describe the scene.", "seconds": 60},
    {"id": "tie-3", "type": "circumlocution", "level": "B1", "prompt": "Explain the word 'wrench' (chave inglesa) WITHOUT saying it. Use: 'It's a tool that…', 'You use it to…'.", "target": "wrench", "seconds": 45},
    {"id": "tie-4", "type": "circumlocution", "level": "B1", "prompt": "Explain 'deadline' without saying the word.", "target": "deadline", "seconds": 45},
    {"id": "tie-5", "type": "circumlocution", "level": "B2", "prompt": "Explain 'bottleneck' (in a factory) without saying it.", "target": "bottleneck", "seconds": 60},
    {"id": "tie-6", "type": "self_talk", "level": "A2", "prompt": "Narrate what you're going to do in the next hour, in English, as if you were talking to yourself.", "seconds": 60},
    {"id": "tie-7", "type": "self_talk", "level": "B1", "prompt": "Narrate your way to work: what you see, what you think, what you plan to do today.", "seconds": 90},
    {"id": "tie-8", "type": "chain", "level": "B1", "prompt": "Answer in a chain: (1) What's your favorite tool or software? (2) Why? (3) Give an example of when it helped you.", "seconds": 90},
    {"id": "tie-9", "type": "chain", "level": "B2", "prompt": "Chain: (1) A problem at work this month. (2) Its cause. (3) What you did. (4) What you'd do differently.", "seconds": 120},
    {"id": "tie-10", "type": "rephrase", "level": "B1", "prompt": "Say the same idea in 3 different ways: 'We don't have enough time.'", "seconds": 45},
    {"id": "tie-11", "type": "rephrase", "level": "B2", "prompt": "Say this more diplomatically in 2 ways: 'Your plan is bad.'", "seconds": 45},
    {"id": "tie-12", "type": "describe_scene", "level": "B2", "prompt": "Describe a machine or product you know well to someone who has never seen it: shape, parts, how it works.", "seconds": 90},
]

# Shadowing: foco em connected speech, ritmo (stress-timed) e entonação.
SHADOWING_EN: list[dict] = [
    {"id": "sh-1", "level": "A2", "accent": "US", "text": "Could you say that again, please?", "focus_pt": "'Could you' → /kʊdʒə/ (assimilação). Entonação descendente-educada no final."},
    {"id": "sh-2", "level": "A2", "accent": "US", "text": "What do you do?", "focus_pt": "Em fala rápida: /wədəjə duː/ — 'what do you' quase some."},
    {"id": "sh-3", "level": "A2", "accent": "UK", "text": "I'd like a table for two, please.", "focus_pt": "'I'd like a' → /aɪd laɪkə/; acento em 'table' e 'two'."},
    {"id": "sh-4", "level": "B1", "accent": "US", "text": "I'm gonna check with the team and get back to you.", "focus_pt": "'gonna', 'get back to you' → /ɡet bæk tə jə/. Palavras funcionais ficam fracas."},
    {"id": "sh-5", "level": "B1", "accent": "US", "text": "Did you get a chance to look at the drawing?", "focus_pt": "'Did you' → /dɪdʒə/; 'get a' → /ɡedə/ (flap T americano)."},
    {"id": "sh-6", "level": "B1", "accent": "UK", "text": "Sorry, I didn't quite catch that.", "focus_pt": "'didn't quite' — T glotal britânico; 'catch that' sem pausa."},
    {"id": "sh-7", "level": "B1", "accent": "US", "text": "Let's go over the action items before we wrap up.", "focus_pt": "Linking: 'go over' → /ɡoʊwoʊvər/, 'items before' — ritmo em 'ac-', 'be-FORE', 'wrap UP'."},
    {"id": "sh-8", "level": "B1", "accent": "AU", "text": "No worries, we'll sort it out this afternoon.", "focus_pt": "'sort it out' → /sɔːrɾɪɾaʊt/ — ligação contínua."},
    {"id": "sh-9", "level": "B2", "accent": "US", "text": "The problem isn't the design itself, it's the tolerance stack-up.", "focus_pt": "Ênfase contrastiva: 'isn't the DESIGN… it's the TOLERANCE stack-up'."},
    {"id": "sh-10", "level": "B2", "accent": "UK", "text": "I see your point, but I'd push back on the timeline.", "focus_pt": "Entonação de discordância educada: sobe em 'point', cai em 'timeline'."},
    {"id": "sh-11", "level": "B2", "accent": "US", "text": "If we'd caught it earlier, we wouldn't have scrapped the whole batch.", "focus_pt": "'we'd caught it' → /wid kɔːɾɪt/; 'wouldn't have' → /wʊdnəv/."},
    {"id": "sh-12", "level": "B2", "accent": "IN", "text": "We need to align with the plant before we roll out the new template.", "focus_pt": "Sotaque indiano: ritmo mais silábico; útil para treinar compreensão."},
    {"id": "sh-13", "level": "B1", "accent": "US", "text": "What's the lead time on those parts?", "focus_pt": "'What's the' → /wʌtsðə/; acento em LEAD time e PARTS."},
    {"id": "sh-14", "level": "B2", "accent": "UK", "text": "Just to make sure we're on the same page, the release is next Friday, right?", "focus_pt": "Tag question 'right?' com entonação ascendente (pedido de confirmação)."},
    {"id": "sh-15", "level": "C1", "accent": "US", "text": "Had we standardized those fasteners sooner, we'd be carrying far less inventory.", "focus_pt": "Inversão condicional; ritmo: HAD we STANdardized… FAR less INventory."},
]

# Tópicos para conversa livre (tutor offline e quebra-gelos do tutor com IA).
CONVERSATION_TOPICS_EN: dict[str, list[str]] = {
    "A2": ["Tell me about your typical workday.", "What do you like to do on weekends?", "Tell me about your city.", "What kind of food do you like?"],
    "B1": ["Tell me about a project you're proud of.", "What's the best trip you've ever taken?", "How do you usually prepare for an important meeting?", "What would you like to see during your trip abroad?"],
    "B2": ["What's a technical decision you disagreed with, and why?", "How do you see your industry changing in five years?", "Describe a time you had to explain something complex to a non-technical person.", "What makes a meeting productive, in your opinion?"],
    "C1": ["Where do you draw the line between standardization and innovation?", "How would you lead a team across different cultures?", "What's an unpopular opinion you have about engineering?"],
}

FOLLOW_UPS_EN = [
    "Interesting! Can you tell me more about that?",
    "Why do you think that is?",
    "How did that make you feel?",
    "What happened next?",
    "Can you give me an example?",
    "That's a good point. What would you do differently?",
    "And how does that compare with Brazil?",
]

BACKCHANNELS_EN = ["I see.", "Got it.", "Oh, really?", "That makes sense.", "Interesting.", "Right.", "Nice!"]
