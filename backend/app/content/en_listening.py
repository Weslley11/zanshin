"""Exercícios de listening (comprehensible input) com progressão de dificuldade, sotaques e velocidade.

Cada exercício: diálogo/monólogo em linhas (speaker, accent, text) para síntese de voz,
perguntas de compreensão (gist → detalhe → inferência), ditado de trechos-chave e notas de
connected speech. O cliente controla velocidade (0.75x–1.25x) e pode revelar a transcrição.
"""

from __future__ import annotations

from app.content.india import LISTENING_INDIA

LISTENING_EN: list[dict] = [
    {
        "id": "lst-en-hotel-checkin", "title": "Check-in no hotel", "level": "A2", "domain": "travel", "phase": 1,
        "accents": ["US"],
        "lines": [
            {"speaker": "Receptionist", "accent": "US", "text": "Good evening! Welcome to the Lakeside Inn. How can I help you?"},
            {"speaker": "Guest", "accent": "UK", "text": "Hi, I have a reservation under Costa. Three nights."},
            {"speaker": "Receptionist", "accent": "US", "text": "Let me check... Yes, Mr. Costa, a king room until Friday. Can I see your passport and a credit card for incidentals?"},
            {"speaker": "Guest", "accent": "UK", "text": "Sure. Is breakfast included?"},
            {"speaker": "Receptionist", "accent": "US", "text": "It is. It's served from six thirty to ten in the restaurant on the ground floor. Your room is four-twelve, and the Wi-Fi password is on the key card holder."},
        ],
        "questions": [
            {"type": "mc", "q": "How many nights is the guest staying?", "options": ["Two", "Three", "Four", "Five"], "answer": 1},
            {"type": "mc", "q": "Why does the receptionist ask for a credit card?", "options": ["To pay the room now", "For incidentals (extra charges)", "To book breakfast", "To open the door"], "answer": 1},
            {"type": "open", "q": "What's the room number?", "accepted": ["412", "four twelve", "four-twelve", "4-12"]},
        ],
        "dictation": ["Is breakfast included?", "Can I see your passport?"],
        "connected_speech": ["'Let me check' → /lemmi tʃek/", "'Can I' → /kənaɪ/ (o 'can' fica fraco: 'kən')"],
        "key_phrases": ["I have a reservation under…", "incidentals", "Is breakfast included?"],
    },
    {
        "id": "lst-en-airport-immigration", "title": "Imigração no aeroporto", "level": "A2", "domain": "travel", "phase": 1,
        "accents": ["US"],
        "lines": [
            {"speaker": "Officer", "accent": "US", "text": "Next, please. Passport. What's the purpose of your visit?"},
            {"speaker": "Traveler", "accent": "US", "text": "Business. I'm visiting our plant in Ohio for two weeks."},
            {"speaker": "Officer", "accent": "US", "text": "What kind of work do you do?"},
            {"speaker": "Traveler", "accent": "US", "text": "I'm a mechanical engineer. We're going to standardize some components with the local team."},
            {"speaker": "Officer", "accent": "US", "text": "Where are you staying?"},
            {"speaker": "Traveler", "accent": "US", "text": "At the Hilton Garden Inn in Dayton. The company booked it."},
            {"speaker": "Officer", "accent": "US", "text": "Alright. Look into the camera, please... Enjoy your stay."},
        ],
        "questions": [
            {"type": "mc", "q": "How long will the traveler stay?", "options": ["Two days", "One week", "Two weeks", "One month"], "answer": 2},
            {"type": "mc", "q": "Who booked the hotel?", "options": ["The traveler", "The officer", "The company", "A friend"], "answer": 2},
            {"type": "open", "q": "What is the purpose of the visit? (one word)", "accepted": ["business", "work"]},
        ],
        "dictation": ["What's the purpose of your visit?", "Where are you staying?"],
        "connected_speech": ["'What's the purpose of' → /wʌts ðə ˈpɜːrpəsəv/", "'Look into' → /lʊkɪntə/"],
        "key_phrases": ["purpose of your visit", "Where are you staying?", "The company booked it."],
    },
    {
        "id": "lst-en-standup", "title": "Daily stand-up meeting", "level": "B1", "domain": "meetings", "phase": 1,
        "accents": ["US", "IN"],
        "lines": [
            {"speaker": "Lead", "accent": "US", "text": "Morning, everyone. Let's keep it short. Priya, you wanna start?"},
            {"speaker": "Priya", "accent": "IN", "text": "Sure. Yesterday I finished the drawings for the new bracket. Today I'm gonna update the BOM. No blockers."},
            {"speaker": "Lead", "accent": "US", "text": "Great. Carlos?"},
            {"speaker": "Carlos", "accent": "US", "text": "I'm still waiting on the supplier for the bearing quote. If I don't hear back by noon, I'll follow up by phone."},
            {"speaker": "Lead", "accent": "US", "text": "OK, keep me in the loop on that one. It's on the critical path."},
        ],
        "questions": [
            {"type": "mc", "q": "What will Priya do today?", "options": ["Finish drawings", "Update the BOM", "Call the supplier", "Nothing"], "answer": 1},
            {"type": "mc", "q": "What is Carlos waiting for?", "options": ["A drawing", "A bearing quote", "A meeting", "His manager"], "answer": 1},
            {"type": "mc", "q": "Why does the lead want updates about the quote?", "options": ["It's on the critical path", "It's cheap", "Carlos is new", "Priya asked"], "answer": 0},
        ],
        "dictation": ["Today I'm gonna update the BOM.", "Keep me in the loop on that one."],
        "connected_speech": ["'you wanna start' = 'do you want to start'", "'gonna' = 'going to'", "'hear back' — o 'r' americano é pronunciado"],
        "key_phrases": ["No blockers.", "follow up", "keep me in the loop", "critical path"],
    },
    {
        "id": "lst-en-restaurant", "title": "Jantar com colegas", "level": "B1", "domain": "travel", "phase": 1,
        "accents": ["UK"],
        "lines": [
            {"speaker": "Waiter", "accent": "UK", "text": "Are you ready to order, or do you need a few more minutes?"},
            {"speaker": "Guest", "accent": "US", "text": "I think we're ready. I'll have the steak, medium rare, with a side salad instead of chips."},
            {"speaker": "Waiter", "accent": "UK", "text": "Of course. Anything to drink?"},
            {"speaker": "Guest", "accent": "US", "text": "Just a sparkling water, please. And could we get the bill on separate checks? It's for expenses."},
            {"speaker": "Waiter", "accent": "UK", "text": "No problem, I'll split it for you at the end."},
        ],
        "questions": [
            {"type": "mc", "q": "What does the guest want instead of chips?", "options": ["Rice", "A side salad", "Soup", "Bread"], "answer": 1},
            {"type": "mc", "q": "Why do they want separate checks?", "options": ["They don't know each other", "For expense reports", "It's cheaper", "The waiter asked"], "answer": 1},
        ],
        "dictation": ["Are you ready to order?", "Could we get separate checks?"],
        "connected_speech": ["UK 'chips' = US 'fries'", "'I'll have' → /aɪl hæv/ — use para pedir de forma natural"],
        "key_phrases": ["I'll have…", "instead of", "separate checks / split the bill"],
    },
    {
        "id": "lst-en-tech-problem", "title": "Explicando um problema técnico", "level": "B2", "domain": "engineering", "phase": 2,
        "accents": ["UK", "US"],
        "lines": [
            {"speaker": "Engineer", "accent": "UK", "text": "So, here's what we're seeing. The press stops every couple of hours with an overpressure alarm, but the pressure readings look normal on the HMI."},
            {"speaker": "Manager", "accent": "US", "text": "Could it be the sensor itself?"},
            {"speaker": "Engineer", "accent": "UK", "text": "That was our first thought. We swapped it yesterday and the problem came back. Now we suspect the wiring — there's a connector near the hydraulic unit that gets quite hot."},
            {"speaker": "Manager", "accent": "US", "text": "What's the impact on production?"},
            {"speaker": "Engineer", "accent": "UK", "text": "About forty minutes of downtime per shift. As a workaround, we're resetting manually, but it's not sustainable. We'd like to replace the harness this weekend."},
        ],
        "questions": [
            {"type": "mc", "q": "What did they already try?", "options": ["Replacing the harness", "Replacing the sensor", "Changing the HMI", "Stopping production"], "answer": 1},
            {"type": "mc", "q": "What do they suspect now?", "options": ["The pressure is too high", "The wiring/connector", "The operator", "The software"], "answer": 1},
            {"type": "open", "q": "How much downtime per shift? (minutes)", "accepted": ["40", "forty", "about 40", "40 minutes", "forty minutes"]},
        ],
        "dictation": ["We swapped it yesterday and the problem came back.", "It's not sustainable."],
        "connected_speech": ["'couple of' → /kʌpləv/", "'We'd like to' → /wid laɪktə/"],
        "key_phrases": ["here's what we're seeing", "we suspect…", "as a workaround", "downtime per shift"],
        "structure_tip_pt": "Estrutura útil para explicar problemas: sintoma → o que já testamos → hipótese atual → impacto → próximo passo.",
    },
    {
        "id": "lst-en-deadline-negotiation", "title": "Negociando prazos", "level": "B2", "domain": "meetings", "phase": 2,
        "accents": ["AU", "US"],
        "lines": [
            {"speaker": "Client", "accent": "AU", "text": "We really need the first batch by the fifteenth. Is there any way you can make that happen?"},
            {"speaker": "Supplier", "accent": "US", "text": "I understand the pressure. To be honest, the fifteenth is tight because the castings have an eight-week lead time."},
            {"speaker": "Client", "accent": "AU", "text": "What if we accepted a partial delivery?"},
            {"speaker": "Supplier", "accent": "US", "text": "That could work. We could ship two hundred units by the fifteenth and the remaining three hundred by the end of the month — provided we get the PO this week."},
            {"speaker": "Client", "accent": "AU", "text": "Alright, let me run it by our planning team and get back to you tomorrow."},
        ],
        "questions": [
            {"type": "mc", "q": "Why is the date difficult?", "options": ["The factory is closed", "Castings have a long lead time", "The client changed the design", "There's no budget"], "answer": 1},
            {"type": "mc", "q": "What's the proposed solution?", "options": ["Cancel the order", "A partial delivery", "Air freight", "A new supplier"], "answer": 1},
            {"type": "mc", "q": "What condition does the supplier mention?", "options": ["Getting the PO this week", "A price increase", "A new drawing", "A visit to the plant"], "answer": 0},
        ],
        "dictation": ["Is there any way you can make that happen?", "Let me run it by our planning team."],
        "connected_speech": ["'What if we' → /wɒtɪf wi/", "AU: 'day' soa próximo de 'die'"],
        "key_phrases": ["make that happen", "tight", "partial delivery", "provided (that)…", "run it by"],
    },
    {
        "id": "lst-en-networking", "title": "Small talk no networking", "level": "B1", "domain": "networking", "phase": 2,
        "accents": ["UK", "IN"],
        "lines": [
            {"speaker": "Anna", "accent": "UK", "text": "Hi, I don't think we've met. I'm Anna, from the Birmingham site."},
            {"speaker": "Rahul", "accent": "IN", "text": "Nice to meet you, Anna. Rahul — I work in automation in Pune. Is this your first time at the conference?"},
            {"speaker": "Anna", "accent": "UK", "text": "Second, actually. I came last year, but it was much smaller. How about you?"},
            {"speaker": "Rahul", "accent": "IN", "text": "First time. I'm presenting tomorrow on PLC standardization, so I'm a bit nervous, to be honest."},
            {"speaker": "Anna", "accent": "UK", "text": "Oh, I'll try to catch it. We're dealing with exactly that problem right now."},
        ],
        "questions": [
            {"type": "mc", "q": "Is it Anna's first time at the conference?", "options": ["Yes", "No, it's her second time", "She doesn't say", "No, she comes every month"], "answer": 1},
            {"type": "mc", "q": "Why is Rahul nervous?", "options": ["He's late", "He's presenting tomorrow", "He lost his badge", "He doesn't know anyone"], "answer": 1},
        ],
        "dictation": ["I don't think we've met.", "I'll try to catch it."],
        "connected_speech": ["'I don't think we've met' → /aɪ dəʊnt θɪŋk wiv met/", "IN: ritmo silábico, 't' e 'd' retroflexos"],
        "key_phrases": ["I don't think we've met.", "How about you?", "catch (a talk)", "we're dealing with…"],
    },
    {
        "id": "lst-en-presentation-qa", "title": "Perguntas após apresentação", "level": "C1", "domain": "meetings", "phase": 3,
        "accents": ["US", "UK"],
        "lines": [
            {"speaker": "Audience", "accent": "US", "text": "Thanks for the presentation. You mentioned a thirty percent reduction in part numbers. How did you handle legacy products that are still under service contracts?"},
            {"speaker": "Presenter", "accent": "UK", "text": "Great question. We didn't touch them, basically. Anything under a service contract keeps its original components until end of support. The reduction comes entirely from new and active products."},
            {"speaker": "Audience", "accent": "US", "text": "And did you get pushback from the plants?"},
            {"speaker": "Presenter", "accent": "UK", "text": "Quite a lot, initially. What helped was showing each plant its own inventory savings, rather than a corporate number nobody could relate to."},
        ],
        "questions": [
            {"type": "mc", "q": "What happened to legacy products under service contracts?", "options": ["They were redesigned", "They kept original components", "They were discontinued", "They got new part numbers"], "answer": 1},
            {"type": "mc", "q": "What reduced resistance from the plants?", "options": ["A corporate mandate", "Showing each plant its own savings", "Extra budget", "Training sessions"], "answer": 1},
        ],
        "dictation": ["How did you handle legacy products?", "Quite a lot, initially."],
        "connected_speech": ["'Great question' — técnica para ganhar tempo antes de responder", "'didn't touch them' → /dɪdn tʌtʃəm/"],
        "key_phrases": ["How did you handle…?", "pushback", "end of support", "relate to"],
    },
    {
        "id": "lst-en-unexpected-flight", "title": "Voo cancelado", "level": "B1", "domain": "travel", "phase": 3,
        "accents": ["US"],
        "lines": [
            {"speaker": "Agent", "accent": "US", "text": "I'm sorry, sir, your flight to Chicago has been canceled due to weather. The next available flight is tomorrow at seven a.m."},
            {"speaker": "Traveler", "accent": "US", "text": "Tomorrow? I have a meeting there at nine. Is there anything earlier, maybe with a connection?"},
            {"speaker": "Agent", "accent": "US", "text": "Let me see... I can get you on a flight to Detroit tonight at eight forty, connecting to Chicago, arriving at eleven fifty p.m."},
            {"speaker": "Traveler", "accent": "US", "text": "That works. Will my checked bag be transferred automatically?"},
            {"speaker": "Agent", "accent": "US", "text": "Yes, it'll be checked through to Chicago. Here's your new boarding pass and a meal voucher."},
        ],
        "questions": [
            {"type": "mc", "q": "Why was the flight canceled?", "options": ["Technical problem", "Weather", "Strike", "Overbooking"], "answer": 1},
            {"type": "mc", "q": "Where is the connection?", "options": ["Chicago", "Detroit", "Dallas", "Denver"], "answer": 1},
            {"type": "open", "q": "What else does the traveler receive besides the boarding pass?", "accepted": ["a meal voucher", "meal voucher", "voucher"]},
        ],
        "dictation": ["Is there anything earlier?", "Will my checked bag be transferred automatically?"],
        "connected_speech": ["'Let me see' → /lemmi siː/", "'checked through' — bagagem despachada até o destino final"],
        "key_phrases": ["due to weather", "next available flight", "checked through", "meal voucher"],
    },
    {
        "id": "lst-en-factory-visit", "title": "Visita técnica à fábrica", "level": "B2", "domain": "engineering", "phase": 3,
        "accents": ["UK", "AU"],
        "lines": [
            {"speaker": "Host", "accent": "UK", "text": "This is our main assembly line. We run two shifts, and takt time is about ninety seconds per unit."},
            {"speaker": "Visitor", "accent": "US", "text": "What's your biggest bottleneck at the moment?"},
            {"speaker": "Host", "accent": "UK", "text": "Final testing, without a doubt. Each unit spends four minutes on the test bench, so we've got three benches running in parallel."},
            {"speaker": "Visitor", "accent": "US", "text": "Have you considered automating part of the test sequence?"},
            {"speaker": "Host", "accent": "AU", "text": "We're piloting that now, actually. If it works, we could free up one bench and one operator per shift."},
        ],
        "questions": [
            {"type": "mc", "q": "What's the biggest bottleneck?", "options": ["Assembly", "Painting", "Final testing", "Packaging"], "answer": 2},
            {"type": "mc", "q": "Why do they use three test benches?", "options": ["Each test takes four minutes", "They have three products", "Each operator has one", "For safety"], "answer": 0},
            {"type": "open", "q": "What's the takt time? (seconds)", "accepted": ["90", "ninety", "about 90", "90 seconds"]},
        ],
        "dictation": ["What's your biggest bottleneck at the moment?", "We're piloting that now, actually."],
        "connected_speech": ["'without a doubt' → /wɪðaʊtə daʊt/", "'actually' aqui = 'na verdade' (não 'atualmente')"],
        "key_phrases": ["takt time", "bottleneck", "run in parallel", "free up"],
    },
]

# Diálogos com falantes indianos (preparação para a Índia)
LISTENING_EN = LISTENING_EN + LISTENING_INDIA
