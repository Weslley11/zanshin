"""Preparação para a Índia: compreender o inglês indiano (Indian English) no trabalho e na viagem.

Foco em COMPREENSÃO: o aprendiz não precisa adotar o sotaque, e sim entender colegas, fornecedores,
motoristas e atendentes. Conteúdo: guia de pronúncia e uso, expressões, números (lakh/crore),
comunicação no ambiente de trabalho, diálogos de listening, simulações, shadowing e quick response.

Observação honesta: vozes sintéticas en-IN (dispositivo/Azure) aproximam o sotaque, mas a fala real
é mais rápida, mistura palavras em hindi/línguas locais e vem com ruído e ligações telefônicas.
Por isso o guia recomenda complementar com áudio autêntico.
"""

from __future__ import annotations

# Formato do vocabulário igual ao de en_vocab.VOCAB_EN: (termo, tipo, significado_pt, exemplo, domínio, CEFR, prioridade)
VOCAB_EN_INDIA: list[tuple[str, str, str, str, str, str, int]] = [
    ("do the needful", "indian_english", "fazer o necessário (pedido formal muito comum)", "Kindly check the drawing and do the needful.", "india", "B1", 140),
    ("revert (back)", "indian_english", "responder / dar retorno (não é 'reverter')", "Please revert by EOD with the revised BOM.", "india", "B1", 141),
    ("prepone", "indian_english", "antecipar (o oposto de 'postpone')", "Can we prepone the meeting to 10:30?", "india", "B1", 142),
    ("kindly", "indian_english", "por favor (formal, muito usado em e-mails e pedidos)", "Kindly share the test report.", "india", "B1", 143),
    ("lakh", "indian_english", "100 mil (1,00,000) — 5 lakh = 500 mil", "The tooling cost is around five lakh rupees.", "india", "B1", 144),
    ("crore", "indian_english", "10 milhões (1,00,00,000) — 2 crore = 20 milhões", "The project budget is two crore.", "india", "B1", 145),
    ("today only / now itself", "indian_english", "hoje mesmo / agora mesmo ('only' e 'itself' dão ênfase)", "I will send it today only. Call him now itself.", "india", "B1", 146),
    ("yesterday night", "indian_english", "ontem à noite (= last night)", "Yesterday night the line stopped twice.", "india", "B1", 147),
    ("out of station", "indian_english", "fora da cidade, viajando", "Mr. Rao is out of station till Monday.", "india", "B1", 148),
    ("..., no? / ..., na? / isn't it?", "indian_english", "…, né? (pedido de confirmação no fim da frase)", "You are coming tomorrow, no? It's a good design, isn't it?", "india", "B1", 149),
    ("I have a doubt", "indian_english", "tenho uma pergunta (na Índia 'doubt' = dúvida/pergunta; internacionalmente use 'question')", "Sir, I have a doubt about the tolerance.", "india", "B1", 150),
    ("do one thing", "indian_english", "faça o seguinte (introduz uma sugestão)", "Do one thing — send me the 3D model, I'll check it.", "india", "B1", 151),
    ("intimate (someone)", "indian_english", "informar/avisar alguém", "I will intimate you once the material is dispatched.", "india", "B2", 152),
    ("passed out (of college)", "indian_english", "formou-se (concluiu a faculdade)", "I passed out from IIT Madras in 2015.", "india", "B1", 153),
    ("fresher", "indian_english", "recém-formado (primeiro emprego)", "We have hired three freshers for the design team.", "india", "B1", 154),
    ("What is your good name?", "indian_english", "Qual é o seu nome? (forma polida)", "Sir, what is your good name?", "india", "A2", 155),
    ("veg / non-veg", "indian_english", "vegetariano / não vegetariano (pergunta comum em refeições)", "Are you veg or non-veg, sir?", "india", "A2", 156),
    ("a little spicy only", "indian_english", "só um pouco apimentado (cuidado: o 'pouco' pode ser bem picante)", "Don't worry, it's a little spicy only.", "india", "A2", 157),
    ("auto (rickshaw)", "indian_english", "autorriquixá (táxi de três rodas)", "Let's take an auto to the metro station.", "india", "A2", 158),
    ("cab", "indian_english", "táxi / carro de aplicativo", "I'll book a cab for you to the airport.", "india", "A2", 159),
    ("signal", "indian_english", "semáforo (traffic light)", "Take a left after the second signal.", "india", "A2", 160),
    ("flyover", "indian_english", "viaduto (overpass)", "The office is just after the flyover.", "india", "B1", 161),
    ("chai", "indian_english", "chá com leite e especiarias (pausa social importante)", "Let's have chai and then discuss.", "india", "A2", 162),
    ("on leave", "indian_english", "de folga / de licença", "Priya is on leave today; she'll revert tomorrow.", "india", "A2", 163),
    ("Please adjust", "indian_english", "por favor, tenha paciência / acomode-se (pedido de flexibilidade)", "The room is small, please adjust.", "india", "B1", 164),
    ("Where do you stay?", "indian_english", "Onde você mora? (stay = morar)", "Where do you stay in Brazil — São Paulo?", "india", "A2", 165),
    ("timepass", "indian_english", "passatempo, algo para passar o tempo", "Cricket on TV is good timepass.", "india", "B1", 166),
    ("Don't take tension", "indian_english", "Não se preocupe", "Don't take tension, sir, we'll manage the deadline.", "india", "B1", 167),
    ("updation", "indian_english", "atualização (= update)", "The updation of the drawings is pending.", "india", "B2", 168),
    ("It may be a little difficult", "indian_english", "frequentemente significa 'não' de forma educada — confirme!", "Friday delivery? It may be a little difficult, sir.", "india", "B2", 169),
]

PRONUNCIATION_FEATURES: list[dict] = [
    {"id": "rhythm", "title_pt": "Ritmo silábico", "example": "development, hotel, event",
     "explain_pt": "Cada sílaba tem duração parecida e as vogais são menos reduzidas. As palavras soam 'cheias' e a tônica pode cair em outra sílaba (HO-tel, DE-velopment).",
     "tip_pt": "Não espere as reduções do inglês americano; preste atenção ao 'contorno' da frase, não só às tônicas."},
    {"id": "retroflex", "title_pt": "T e D retroflexos", "example": "data, doctor, today, total",
     "explain_pt": "O 't' e o 'd' são feitos com a ponta da língua curvada para trás, soando mais 'duros' do que no inglês americano.",
     "tip_pt": "Palavras com t/d continuam reconhecíveis — o contexto ajuda muito."},
    {"id": "v_w", "title_pt": "V e W parecidos", "example": "very well, vendor, we will verify",
     "explain_pt": "Muitos falantes usam um som entre 'v' e 'w' para os dois. 'Very well' pode soar como 'wery vell'.",
     "tip_pt": "Se uma palavra não fizer sentido com 'v', tente com 'w' (e vice-versa)."},
    {"id": "th", "title_pt": "TH como T/D", "example": "three, this, thank you, method",
     "explain_pt": "O 'th' costuma virar um 't' ou 'd' dental (três = 'tree', this = 'dis') — como muitos brasileiros também fazem.",
     "tip_pt": "'Tree hundred' é 'three hundred' — cuidado com números!"},
    {"id": "vowels", "title_pt": "Vogais 'ê' e 'ô' simples", "example": "day, go, make, load",
     "explain_pt": "Ditongos como em 'day' e 'go' viram vogais simples ('dê', 'gô') — bem parecido com o português.",
     "tip_pt": "Esta é uma vantagem para brasileiros: aproveite."},
    {"id": "r", "title_pt": "R pronunciado e batido", "example": "car, water, order",
     "explain_pt": "O 'r' depois de vogal é pronunciado, muitas vezes batido como em 'caro'.",
     "tip_pt": "Outro ponto familiar para brasileiros."},
    {"id": "aspiration", "title_pt": "P, T, K sem sopro", "example": "pen, time, keep",
     "explain_pt": "Sem a 'aspiração' do inglês americano/britânico — igual ao português.",
     "tip_pt": "Não confunda 'pen' com 'ben': o contexto resolve."},
    {"id": "speed", "title_pt": "Velocidade e entonação", "example": "So-what-we-can-do-is...",
     "explain_pt": "No trabalho, a fala costuma ser rápida e com entonação que sobe e desce bastante; perguntas às vezes não invertem a ordem ('You are coming?').",
     "tip_pt": "Peça para repetir sem constrangimento: 'Sorry, could you say that a bit slowly?' é totalmente normal."},
]

GRAMMAR_USAGE: list[dict] = [
    {"pattern": "Progressivo com verbos de estado", "example": "I am having two kids. Client is wanting it by Q3.", "meaning_pt": "= I have two kids. The client wants it by Q3."},
    {"pattern": "'only' / 'itself' para ênfase", "example": "Send it today only. We will do it now itself.", "meaning_pt": "= hoje mesmo / agora mesmo (não 'somente hoje')."},
    {"pattern": "Tags 'no?', 'na?', 'isn't it?'", "example": "You are staying in Pune, no? This is the final drawing, isn't it?", "meaning_pt": "= né? (mesmo quando a gramática 'padrão' pediria outra tag)."},
    {"pattern": "'What we can do is…'", "example": "What we can do is, we can split it into two phases.", "meaning_pt": "Introduz uma proposta — ouça o que vem depois."},
    {"pattern": "Artigos omitidos", "example": "Client has approved. Vendor will send PO.", "meaning_pt": "= The client… The vendor… (comum e não muda o sentido)."},
]

NUMBERS: dict = {
    "explain_pt": "Valores grandes (dinheiro, quantidades) costumam ser ditos em lakh e crore, e escritos com vírgulas a cada 2 dígitos após o primeiro grupo de 3.",
    "table": [
        {"spoken": "one lakh", "written": "1,00,000", "value": 100_000},
        {"spoken": "ten lakh", "written": "10,00,000", "value": 1_000_000},
        {"spoken": "one crore", "written": "1,00,00,000", "value": 10_000_000},
        {"spoken": "twelve lakh fifty thousand", "written": "12,50,000", "value": 1_250_000},
        {"spoken": "two point five crore", "written": "2,50,00,000", "value": 25_000_000},
    ],
    "tip_pt": "Conta rápida: lakh = 100 mil; 10 lakh = 1 milhão; crore = 10 milhões. Rupias: ₹ (INR).",
}

CULTURE_TIPS: list[dict] = [
    {"title_pt": "'Sir' e 'Ma'am'", "tip_pt": "Usados o tempo todo como respeito, inclusive entre colegas. Não é distância nem ironia."},
    {"title_pt": "'Não' indireto", "tip_pt": "'I'll try', 'It may be difficult' ou 'Let me check' podem significar 'não'. Confirme com uma pergunta objetiva: 'So, can we commit to Friday — yes or no?'"},
    {"title_pt": "'Yes' nem sempre é concordância", "tip_pt": "Pode significar 'estou ouvindo'. Resuma e peça confirmação por escrito (e-mail) após reuniões."},
    {"title_pt": "Balançar de cabeça", "tip_pt": "O movimento lateral da cabeça geralmente indica 'ok/entendi', não 'não'."},
    {"title_pt": "Hierarquia", "tip_pt": "Decisões costumam subir para o gestor. Pergunte 'Who needs to approve this?' para entender o prazo real."},
    {"title_pt": "Refeições", "tip_pt": "Pergunta frequente: 'veg or non-veg?'. Muitos colegas são vegetarianos. Recusar comida com educação: 'It's delicious, but I'm full, thank you'."},
    {"title_pt": "Pedir para repetir", "tip_pt": "Com sotaques diferentes dos dois lados, pedir repetição é normal: 'Sorry, I didn't catch the last part' ou 'Could you spell that?'"},
]

AUTHENTIC_AUDIO_PT: list[str] = [
    "NPTEL — videoaulas de engenharia de professores dos IITs (vocabulário técnico com sotaque indiano autêntico).",
    "Noticiários em inglês da Índia (ex.: NDTV, WION, The Hindu) — fala rápida e formal.",
    "Palestras técnicas de empresas indianas e de engenheiros indianos (YouTube) — reuniões e apresentações reais.",
    "Peça a um colega indiano para gravar 1–2 minutos explicando um processo da planta — o melhor material possível.",
]

# ---------------- Listening (falantes indianos com voz en-IN) ----------------
LISTENING_INDIA: list[dict] = [
    {
        "id": "lst-in-airport-arrival", "title": "Chegada a Bengaluru: imigração e táxi", "level": "A2", "domain": "travel", "phase": 1,
        "accents": ["IN"], "country": "IN",
        "lines": [
            {"speaker": "Officer", "accent": "IN", "text": "Good evening. Passport and e-visa printout, please. What is the purpose of your visit?"},
            {"speaker": "Visitor", "accent": "US", "text": "Business. I'm visiting our plant in Pune for two weeks."},
            {"speaker": "Officer", "accent": "IN", "text": "Pune, okay. You will be staying in Pune itself? Kindly fill the hotel address here only."},
            {"speaker": "Visitor", "accent": "US", "text": "Sure. And where can I get a taxi?"},
            {"speaker": "Officer", "accent": "IN", "text": "After customs, on the left side, there is a prepaid taxi counter. Don't take taxi from outside. Welcome to India."},
        ],
        "questions": [
            {"type": "mc", "q": "What does the officer ask the visitor to write?", "options": ["The plant address", "The hotel address", "The flight number", "The phone number"], "answer": 1},
            {"type": "mc", "q": "Where should the visitor get a taxi?", "options": ["Outside the airport", "At the prepaid taxi counter after customs", "At the hotel desk", "At the metro station"], "answer": 1},
            {"type": "mc", "q": "'You will be staying in Pune itself?' means…", "options": ["Only in Pune?", "Exactly in Pune (not elsewhere)?", "Near Pune?", "Never in Pune?"], "answer": 1},
        ],
        "dictation": ["Kindly fill the hotel address here only.", "Don't take taxi from outside."],
        "connected_speech": ["'itself' / 'only' dão ênfase: 'Pune itself' = no próprio Pune", "Artigos omitidos ('take taxi') são comuns e não mudam o sentido"],
        "key_phrases": ["e-visa printout", "Kindly fill…", "prepaid taxi counter"],
    },
    {
        "id": "lst-in-plant-standup", "title": "Reunião diária na planta de Pune", "level": "B1", "domain": "engineering", "phase": 1,
        "accents": ["IN"], "country": "IN",
        "lines": [
            {"speaker": "Rajesh", "accent": "IN", "text": "Good morning, sir. Today we will be doing the trial run on line two itself."},
            {"speaker": "Rajesh", "accent": "IN", "text": "Yesterday night the fixture was giving some problem, so maintenance has done the needful. Now it is working fine."},
            {"speaker": "Priya", "accent": "IN", "text": "Sir, one small doubt. In the drawing, the hole tolerance is plus minus zero point one, but vendor is asking for zero point two."},
            {"speaker": "Priya", "accent": "IN", "text": "Kindly revert on this by EOD, then only we can release the PO to the vendor."},
        ],
        "questions": [
            {"type": "mc", "q": "What happened yesterday night?", "options": ["The line was shut down", "The fixture had a problem and maintenance fixed it", "The vendor visited", "They released the PO"], "answer": 1},
            {"type": "mc", "q": "What is Priya's 'doubt'?", "options": ["A question about the hole tolerance", "She doesn't trust the vendor", "She is not sure about the date", "A problem with line two"], "answer": 0},
            {"type": "mc", "q": "What does Priya need from the visitor by the end of the day?", "options": ["A new drawing", "An answer about the tolerance", "A meeting", "The trial run report"], "answer": 1},
        ],
        "dictation": ["Maintenance has done the needful.", "Kindly revert on this by EOD."],
        "connected_speech": ["'one small doubt' = uma pergunta (não desconfiança)", "'then only we can…' = só então poderemos…", "'zero point one' — números ditos dígito a dígito"],
        "key_phrases": ["do the needful", "revert by EOD", "then only", "release the PO"],
    },
    {
        "id": "lst-in-team-lunch", "title": "Almoço com a equipe", "level": "B1", "domain": "networking", "phase": 2,
        "accents": ["IN"], "country": "IN",
        "lines": [
            {"speaker": "Ankit", "accent": "IN", "text": "Sir, are you veg or non-veg? Here the paneer is very good, and the biryani is non-veg."},
            {"speaker": "Visitor", "accent": "US", "text": "I'll try the paneer. Is it very spicy?"},
            {"speaker": "Ankit", "accent": "IN", "text": "No, no, it's a little spicy only. Take some curd with it, it will be fine. After lunch we'll have chai, no?"},
            {"speaker": "Deepa", "accent": "IN", "text": "You are staying in Koregaon Park, isn't it? Very nice area. On Sunday we can take you to see the fort, if you are free."},
        ],
        "questions": [
            {"type": "mc", "q": "Which dish is non-vegetarian?", "options": ["Paneer", "Biryani", "Curd", "Chai"], "answer": 1},
            {"type": "mc", "q": "What does Ankit suggest to make the food less spicy?", "options": ["Drink water", "Eat it with curd (yogurt)", "Order biryani", "Skip lunch"], "answer": 1},
            {"type": "mc", "q": "What does Deepa offer?", "options": ["To book a hotel", "To take the visitor to see the fort on Sunday", "To change the meeting", "To pay for lunch"], "answer": 1},
        ],
        "dictation": ["Are you veg or non-veg?", "It's a little spicy only."],
        "connected_speech": ["'…, no?' e 'isn't it?' no fim = 'né?'", "'a little spicy only' = só um pouco apimentado"],
        "key_phrases": ["veg or non-veg", "a little spicy only", "curd", "if you are free"],
    },
    {
        "id": "lst-in-supplier-call", "title": "Ligação com fornecedor (lakh e prazos)", "level": "B2", "domain": "corporate", "phase": 2,
        "accents": ["IN"], "country": "IN",
        "lines": [
            {"speaker": "Mr. Venkatesh", "accent": "IN", "text": "Hello sir, Venkatesh this side. Regarding the castings order — total value is around twelve lakh fifty thousand, excluding GST."},
            {"speaker": "Mr. Venkatesh", "accent": "IN", "text": "Tooling charges will be extra, approximately two lakh. Delivery we had committed for the twenty-fifth."},
            {"speaker": "Visitor", "accent": "US", "text": "Could you bring it forward? We need the first batch earlier."},
            {"speaker": "Mr. Venkatesh", "accent": "IN", "text": "We can try to prepone to the eighteenth, sir, provided PO comes today only. It may be a little difficult, but I will check with the foundry and intimate you."},
        ],
        "questions": [
            {"type": "mc", "q": "What is the total value of the order?", "options": ["₹125,000", "₹1,250,000", "₹12,500,000", "₹12,050"], "answer": 1},
            {"type": "mc", "q": "What does 'prepone to the eighteenth' mean?", "options": ["Postpone to the 18th", "Bring the delivery forward to the 18th", "Cancel on the 18th", "Pay on the 18th"], "answer": 1},
            {"type": "mc", "q": "'It may be a little difficult' most likely means…", "options": ["It is guaranteed", "It is probably not possible — confirm before relying on it", "It is very easy", "It will be cheaper"], "answer": 1},
        ],
        "dictation": ["We can try to prepone to the eighteenth.", "I will check with the foundry and intimate you."],
        "connected_speech": ["'Venkatesh this side' = aqui é o Venkatesh (ao telefone)", "lakh = 100 mil → 12,5 lakh = 1,25 milhão", "GST = imposto sobre bens e serviços"],
        "key_phrases": ["this side", "lakh", "excluding GST", "prepone", "provided PO comes today only", "intimate you"],
        "structure_tip_pt": "Ao ouvir valores em lakh/crore, confirme em voz alta: 'So that's 1.25 million rupees, right?'",
    },
    {
        "id": "lst-in-client-meeting", "title": "Reunião com a equipe do cliente", "level": "B2", "domain": "meetings", "phase": 3,
        "accents": ["IN"], "country": "IN",
        "lines": [
            {"speaker": "Suresh", "accent": "IN", "text": "Actually, the requirement has changed slightly. Client is wanting the standardization completed by Q3 itself."},
            {"speaker": "Suresh", "accent": "IN", "text": "What we can do is, we can split it into two phases. Phase one, only the fasteners and bearings. Phase two, the sheet metal parts."},
            {"speaker": "Kavitha", "accent": "IN", "text": "From our side, the updation of the drawings is pending for around forty parts. Please share the latest BOM, we will do the costing and revert."},
            {"speaker": "Suresh", "accent": "IN", "text": "Is it possible from your side, sir? Don't take tension, we will support."},
        ],
        "questions": [
            {"type": "mc", "q": "What does the client want?", "options": ["Cancel the project", "Standardization completed by Q3", "A new supplier", "More sheet metal parts"], "answer": 1},
            {"type": "mc", "q": "What is in phase one?", "options": ["Sheet metal parts", "Fasteners and bearings", "Drawings", "Costing"], "answer": 1},
            {"type": "mc", "q": "What does Kavitha need from the visitor?", "options": ["The latest BOM", "A budget approval", "A plant visit", "New drawings for 40 parts"], "answer": 0},
        ],
        "dictation": ["What we can do is, we can split it into two phases.", "We will do the costing and revert."],
        "connected_speech": ["'Client is wanting' = the client wants (progressivo com verbo de estado)", "'updation' = update", "'Don't take tension' = não se preocupe"],
        "key_phrases": ["What we can do is…", "from your side / from our side", "do the costing", "revert"],
    },
    {
        "id": "lst-in-auto", "title": "Autorriquixá até a MG Road", "level": "A2", "domain": "travel", "phase": 1,
        "accents": ["IN"], "country": "IN",
        "lines": [
            {"speaker": "Driver", "accent": "IN", "text": "Where you want to go, sir? MG Road? Three hundred rupees."},
            {"speaker": "Visitor", "accent": "US", "text": "Can you go by meter, please?"},
            {"speaker": "Driver", "accent": "IN", "text": "Meter is not working, sir. Okay, okay, two hundred fifty, final. Traffic is very heavy near the flyover."},
            {"speaker": "Visitor", "accent": "US", "text": "Two hundred. And please stop near the metro station, after the signal."},
            {"speaker": "Driver", "accent": "IN", "text": "Okay sir, two hundred. Sit, sit."},
        ],
        "questions": [
            {"type": "mc", "q": "What was the final price?", "options": ["₹300", "₹250", "₹200", "By meter"], "answer": 2},
            {"type": "mc", "q": "Where does the visitor want to stop?", "options": ["At the flyover", "Near the metro station, after the traffic light", "At the hotel", "At MG Road mall"], "answer": 1},
        ],
        "dictation": ["Meter is not working, sir.", "Please stop near the metro station, after the signal."],
        "connected_speech": ["'signal' = semáforo", "'flyover' = viaduto", "'Sit, sit' = pode entrar"],
        "key_phrases": ["go by meter", "final (price)", "signal", "flyover"],
    },
]

# ---------------- Simulações na Índia ----------------
SCENARIOS_INDIA: list[dict] = [
    {
        "id": "india-airport-arrival", "category": "airport", "country": "IN", "title_pt": "Índia: imigração e táxi pré-pago", "level": "A2", "phase": 1,
        "domain": "travel", "minutes": 6,
        "setting": "Kempegowda International Airport, Bengaluru, late evening. Immigration desk, then the prepaid taxi counter.",
        "characters": [
            {"name": "Officer Sharma", "role": "immigration officer", "accent": "IN", "speed": "normal", "style": "formal, uses 'kindly' and Indian English word order"},
            {"name": "Mohan", "role": "prepaid taxi counter clerk", "accent": "IN", "speed": "fast", "style": "quick, quotes prices in rupees, asks for the exact area/landmark"},
        ],
        "learner_role": "Business visitor from Brazil on an e-visa",
        "goals": [
            {"id": "purpose", "pt": "Explicar o propósito da viagem", "en": "State the purpose of the visit"},
            {"id": "address", "pt": "Informar onde vai ficar", "en": "Give the hotel/area"},
            {"id": "taxi", "pt": "Contratar o táxi pré-pago e confirmar o preço", "en": "Book the prepaid taxi and confirm the price"},
            {"id": "clarify", "pt": "Pedir para repetir quando não entender", "en": "Ask for repetition/clarification at least once"},
        ],
        "opening": "Good evening. Passport and e-visa printout, please. Purpose of visit?",
        "script": ["Which company you are visiting?", "You will be staying where? Kindly tell the hotel name.", "Okay. Look into the camera, please. Welcome to India.",
                   "Mohan: Yes sir, where to? Whitefield or city side?", "Mohan: Eleven hundred rupees to Whitefield. Cash or card?"],
        "unexpected_events": ["The officer says the hotel address on the form is incomplete and asks for the area and PIN code.",
                              "The taxi clerk says card machine is not working, cash only, and you only have dollars."],
        "useful_phrases": ["I'm here on business, visiting our plant in Pune.", "I'm staying at… in…", "Sorry, could you repeat that?", "Is there an ATM or forex counter nearby?"],
    },
    {
        "id": "india-auto-cab", "category": "transport", "country": "IN", "title_pt": "Índia: autorriquixá e cab", "level": "A2", "phase": 1,
        "domain": "travel", "minutes": 5,
        "setting": "Outside a metro station in Bengaluru. The learner needs to get to a client office using landmarks.",
        "characters": [{"name": "Ravi", "role": "auto-rickshaw driver", "accent": "IN", "speed": "fast", "style": "friendly, negotiates, short sentences, says 'sir' a lot"}],
        "learner_role": "Visitor going to a client office",
        "goals": [
            {"id": "destination", "pt": "Explicar o destino com um ponto de referência", "en": "Explain the destination with a landmark"},
            {"id": "price", "pt": "Negociar o preço ou pedir taxímetro", "en": "Agree on price or ask for the meter"},
            {"id": "stop", "pt": "Pedir para parar no lugar certo", "en": "Ask to stop at the right place"},
        ],
        "opening": "Where you want to go, sir?",
        "script": ["That side? Near which landmark?", "Three hundred rupees, sir. Meter not working.", "Okay, okay, final price two fifty.", "This signal, left or straight?", "Reached, sir."],
        "unexpected_events": ["The driver says the road is blocked and wants to take a longer route for more money.", "The driver doesn't know the office; you need to explain using a landmark."],
        "useful_phrases": ["Can you go by meter?", "It's near the… / opposite the…", "Two hundred is fine?", "Please stop here, after the signal."],
    },
    {
        "id": "india-plant-visit", "category": "work", "country": "IN", "title_pt": "Índia: visita técnica à planta de Pune", "level": "B2", "phase": 2,
        "domain": "engineering", "minutes": 12,
        "setting": "Shop floor and meeting room at an automotive components plant in Pune. A fixture is producing out-of-tolerance parts and a standardization rollout is starting.",
        "characters": [
            {"name": "Priya Nair", "role": "quality engineer", "accent": "IN", "speed": "fast", "style": "precise, data-driven, uses 'one small doubt', 'kindly revert', 'then only'"},
            {"name": "Rajesh Kumar", "role": "production manager", "accent": "IN", "speed": "normal", "style": "polite and indirect; 'it may be a little difficult' often means no; very respectful ('sir')"},
        ],
        "learner_role": "Visiting engineer from the Brazilian headquarters",
        "goals": [
            {"id": "understand", "pt": "Entender o problema e resumir com suas palavras", "en": "Understand the problem and summarize it back"},
            {"id": "clarify", "pt": "Esclarecer algo que não entendeu (pedir repetição ou soletrar)", "en": "Clarify something not understood"},
            {"id": "decide", "pt": "Obter um 'sim' ou 'não' claro sobre o prazo", "en": "Get a clear yes/no on the timeline"},
            {"id": "actions", "pt": "Combinar responsáveis e prazos por escrito", "en": "Agree owners and dates, and confirm by email"},
        ],
        "opening": "Good morning, sir! Welcome to Pune plant. Shall we start with the line, then we'll have chai and discuss?",
        "script": ["Priya: Sir, one small doubt. In revision C the hole tolerance is plus minus zero point one, but vendor is asking zero point two.",
                   "Rajesh: Yesterday night the fixture was giving problem, so maintenance has done the needful.",
                   "Priya: Kindly revert on the tolerance by EOD, then only we can release the PO.",
                   "Rajesh: Friday rollout? It may be a little difficult, sir. We will try our level best.",
                   "Priya: Shall I send the minutes of meeting to all?"],
        "unexpected_events": ["A power cut stops the line for twenty minutes and Rajesh suggests continuing the discussion over chai.",
                              "Priya speaks very fast with a code you don't recognize (a part number) and you must ask her to spell it."],
        "useful_phrases": ["Just to make sure I understood: …", "Sorry, could you spell the part number?", "So, can we commit to Friday — yes or no?", "Who needs to approve this?", "I'll send a summary by email."],
    },
    {
        "id": "india-team-lunch", "category": "restaurant", "country": "IN", "title_pt": "Índia: almoço e conversa com colegas", "level": "B1", "phase": 2,
        "domain": "networking", "minutes": 8,
        "setting": "Company canteen and a nearby restaurant ('hotel') in Pune with two Indian colleagues.",
        "characters": [
            {"name": "Ankit", "role": "design engineer", "accent": "IN", "speed": "fast", "style": "cheerful, talks about cricket and food, uses 'no?' tags"},
            {"name": "Deepa", "role": "project manager", "accent": "IN", "speed": "normal", "style": "curious about Brazil, invites the learner to events"},
        ],
        "learner_role": "Visiting engineer",
        "goals": [
            {"id": "order", "pt": "Escolher a comida (veg/non-veg, apimentado)", "en": "Choose food (veg/non-veg, spice level)"},
            {"id": "smalltalk", "pt": "Manter small talk (cricket, futebol, cidades)", "en": "Keep small talk going"},
            {"id": "invite", "pt": "Responder a um convite com educação", "en": "Respond politely to an invitation"},
        ],
        "opening": "Sir, are you veg or non-veg? The biryani here is famous.",
        "script": ["Ankit: Not too spicy, a little spicy only. You'll manage, no?", "Deepa: Where do you stay in Brazil? São Paulo?",
                   "Ankit: You follow cricket? India–Australia match is on Sunday.", "Deepa: My cousin's wedding is next week — you must come, it's a nice experience!"],
        "unexpected_events": ["The food is much spicier than expected and you need to politely ask for something milder.", "Deepa invites you to a wedding on the same evening as a work call."],
        "useful_phrases": ["I'd prefer something not too spicy.", "It's delicious, but I'm full, thank you.", "I'd love to come! Let me check my schedule.", "We don't follow cricket much in Brazil, but football…"],
    },
    {
        "id": "india-supplier-negotiation", "category": "work", "country": "IN", "title_pt": "Índia: negociação com fornecedor (lakh/crore)", "level": "B2", "phase": 3,
        "domain": "corporate", "minutes": 10,
        "setting": "Video call with a castings supplier in Coimbatore. Prices in lakh, delivery dates and tooling charges.",
        "characters": [{"name": "Mr. Venkatesh", "role": "supplier sales head", "accent": "IN", "speed": "fast", "style": "very polite, fast, quotes in lakh/crore, avoids saying no directly"}],
        "learner_role": "Engineering lead responsible for the delivery",
        "goals": [
            {"id": "numbers", "pt": "Entender e confirmar valores em lakh", "en": "Understand and confirm amounts in lakh"},
            {"id": "date", "pt": "Obter uma data firme (prepone)", "en": "Get a firm (earlier) date"},
            {"id": "writing", "pt": "Pedir confirmação por escrito", "en": "Ask for written confirmation"},
        ],
        "opening": "Hello sir, Venkatesh this side. Regarding your castings order — shall I share the revised quotation?",
        "script": ["Total value is around twelve lakh fifty thousand, excluding GST.", "Tooling charges extra, approximately two lakh only.",
                   "Delivery we can try to prepone, but it may be a little difficult.", "If PO comes today only, eighteenth is possible.", "I will intimate you after checking with foundry."],
        "unexpected_events": ["He quotes 'one point two crore' for an annual contract and you must convert and confirm.", "The connection drops and you must summarize what was agreed."],
        "useful_phrases": ["So that's 1.25 million rupees, excluding GST — correct?", "Can you confirm the 18th in writing?", "What exactly do you need from us to commit?", "Let me repeat what we agreed."],
    },
]

SHADOWING_INDIA: list[dict] = [
    {"id": "sh-in-1", "level": "B1", "accent": "IN", "text": "Kindly do the needful and revert by end of day.", "focus_pt": "Ritmo silábico: cada sílaba com peso parecido. Objetivo é PERCEBER o padrão — você não precisa adotar o sotaque."},
    {"id": "sh-in-2", "level": "B1", "accent": "IN", "text": "We will prepone the meeting to ten thirty, sir.", "focus_pt": "'ten thirty' — o 'th' pode soar como 't' dental."},
    {"id": "sh-in-3", "level": "B1", "accent": "IN", "text": "The order value is around twelve lakh rupees.", "focus_pt": "Números em lakh: ouça o número inteiro antes de converter."},
    {"id": "sh-in-4", "level": "B1", "accent": "IN", "text": "You are coming to the plant tomorrow itself, no?", "focus_pt": "Tag 'no?' no fim com entonação subindo = 'né?'."},
    {"id": "sh-in-5", "level": "B2", "accent": "IN", "text": "What we can do is, we can split the rollout into two phases.", "focus_pt": "'What we can do is…' anuncia a proposta — atenção ao que vem depois."},
    {"id": "sh-in-6", "level": "B2", "accent": "IN", "text": "Yesterday night only the fixture was giving some problem.", "focus_pt": "'Yesterday night only' = ontem à noite mesmo; progressivo com 'giving problem'."},
]

QUICK_RESPONSE_INDIA: list[dict] = [
    {"id": "qr-in-1", "level": "A2", "theme": "india", "q": "Sir, are you veg or non-veg?", "keywords": ["veg", "non-veg", "vegetarian", "eat", "meat", "chicken"], "model": "Non-veg, but I'd like to try some vegetarian dishes too."},
    {"id": "qr-in-2", "level": "B1", "theme": "india", "q": "Which city in India are you visiting, and for how long?", "keywords": ["pune", "bengaluru", "bangalore", "mumbai", "delhi", "chennai", "weeks", "days", "for"], "model": "I'm visiting Pune for two weeks, for work at our plant."},
    {"id": "qr-in-3", "level": "B1", "theme": "india", "q": "Kindly revert on the drawing by EOD. Is it possible?", "keywords": ["yes", "sure", "send", "today", "evening", "tomorrow", "i will", "i'll"], "model": "Sure, I'll check it and get back to you by this evening."},
    {"id": "qr-in-4", "level": "B2", "theme": "india", "q": "Supplier says the order is twelve lakh. How much is that in millions?", "keywords": ["1.2", "one point two", "million", "1,200,000", "1.2 million"], "model": "That's 1.2 million rupees."},
    {"id": "qr-in-5", "level": "B1", "theme": "india", "q": "Can we prepone tomorrow's meeting to nine thirty?", "keywords": ["yes", "sure", "fine", "ok", "okay", "earlier", "no", "can't", "nine"], "model": "Sure, nine thirty works for me."},
    {"id": "qr-in-6", "level": "B2", "theme": "india", "q": "It may be a little difficult to deliver by Friday. What do you say?", "keywords": ["so", "can", "date", "commit", "when", "what", "need", "yes or no"], "model": "I understand. So what date can you commit to, and what do you need from us?"},
]

TUTOR_NOTES_INDIA = (
    "The learner is preparing for a business trip to INDIA and must above all UNDERSTAND Indian English speakers. "
    "When you play Indian characters or represent Indian English: use natural Indian English vocabulary and patterns "
    "(do the needful, revert, prepone, kindly, 'today only'/'now itself', tags 'no?'/'isn't it?', 'one small doubt', "
    "'What we can do is…', progressive with stative verbs, sometimes amounts in lakh/crore, polite 'sir'), "
    "and indirect refusals ('it may be a little difficult'). Do not caricature; keep it respectful and realistic. "
    "In new_vocabulary, prefer Indian English expressions the learner met. Encourage clarification strategies "
    "('Sorry, could you say that again?', 'Just to confirm…')."
)


def variety_guide(code: str) -> dict | None:
    if code.upper() != "IN":
        return None
    return {
        "code": "IN",
        "title_pt": "Inglês da Índia",
        "intro_pt": ("Seu objetivo é entender colegas, fornecedores e atendentes indianos — não adotar o sotaque. "
                     "Boa notícia: vários traços do inglês indiano (vogais simples, 'r' batido, p/t/k sem sopro, 'th' como t/d) "
                     "são parecidos com o português. O desafio costuma ser a velocidade, o ritmo e as expressões locais."),
        "pronunciation": PRONUNCIATION_FEATURES,
        "grammar_usage": GRAMMAR_USAGE,
        "expressions": [{"term": t, "meaning_pt": m, "example": e} for t, _k, m, e, *_ in VOCAB_EN_INDIA],
        "numbers": NUMBERS,
        "culture": CULTURE_TIPS,
        "authentic_audio_pt": AUTHENTIC_AUDIO_PT,
        "voice_note_pt": ("Os áudios usam a voz en-IN do seu aparelho (ou vozes neurais en-IN do servidor, se configuradas). "
                          "Vozes sintéticas são mais lentas e limpas do que a fala real: complemente com áudio autêntico."),
    }
