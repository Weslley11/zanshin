"""Mapas mentais para fixação: um tema no centro, 4 ramos e 3 frases em cada ramo.

O que a pesquisa diz, e como o app usa isso:
- Estudar um mapa pronto ajuda pouco; construir ou reconstruir ajuda mais (Nesbit & Adesope, 2006).
- Recuperar da memória fixa mais do que só montar o mapa olhando o material (Karpicke & Blunt, 2011).
- Montar o mapa de memória e depois conferir funciona tão bem quanto a recuperação livre
  (Blunt & Karpicke, 2014).
Por isso cada mapa tem três modos: Explorar (ver e ouvir), Lembrar (completar as frases escondidas)
e Reconstruir (dizer tudo o que lembra de um ramo antes de abrir). As frases vão para a revisão
espaçada (FSRS). Conteúdo original, escrito para este app.
"""

from __future__ import annotations


def _b(bid: str, en: str, pt: str, icon: str, leaves: list[tuple[str, str]]) -> dict:
    return {"id": bid, "en": en, "pt": pt, "icon": icon,
            "leaves": [{"id": f"{bid}-{k}", "en": e, "pt": p} for k, (e, p) in enumerate(leaves, start=1)]}


MAPS: list[dict] = [
    {
        "id": "mm01", "order": 1, "icon": "people", "track": "work",
        "title_pt": "Reuniões e calls", "center_en": "Meetings", "center_pt": "Reuniões",
        "branches": [
            _b("mm01-a", "Opening", "Abrir", "play", [
                ("Can everyone hear me?", "Todos estão me ouvindo?"),
                ("Let's get started.", "Vamos começar."),
                ("The goal today is to agree on the timeline.", "O objetivo hoje é fechar o cronograma."),
            ]),
            _b("mm01-b", "Clarifying", "Esclarecer", "help-circle", [
                ("Sorry, could you repeat that?", "Desculpe, você pode repetir?"),
                ("Just to make sure I understood, you mean the new line?", "Só para ter certeza que entendi: você quer dizer a linha nova?"),
                ("Could you share your screen?", "Você pode compartilhar a tela?"),
            ]),
            _b("mm01-c", "Disagreeing politely", "Discordar com educação", "swap-horizontal", [
                ("I see your point, but I have a concern.", "Entendo seu ponto, mas tenho uma preocupação."),
                ("What if we tried a different approach?", "E se tentássemos outro caminho?"),
                ("I'm not sure that will work for us.", "Não tenho certeza de que isso funciona para nós."),
            ]),
            _b("mm01-d", "Wrapping up", "Fechar", "checkmark-done", [
                ("Let's recap the action items.", "Vamos recapitular as ações."),
                ("Who owns this task?", "Quem é o responsável por esta tarefa?"),
                ("I'll send the notes after the call.", "Vou mandar a ata depois da call."),
            ]),
        ],
    },
    {
        "id": "mm02", "order": 2, "icon": "warning", "track": "work",
        "title_pt": "Explicar um problema técnico", "center_en": "A technical problem", "center_pt": "Um problema técnico",
        "branches": [
            _b("mm02-a", "Symptom", "Sintoma", "pulse", [
                ("The machine stops every two hours.", "A máquina para a cada duas horas."),
                ("We're seeing a lot of rejects on line two.", "Estamos vendo muito refugo na linha dois."),
                ("It started after the last update.", "Começou depois da última atualização."),
            ]),
            _b("mm02-b", "Cause", "Causa", "search", [
                ("We think it's a sensor issue.", "Achamos que é um problema de sensor."),
                ("The root cause is still unclear.", "A causa raiz ainda não está clara."),
                ("We ruled out the software.", "Descartamos o software."),
            ]),
            _b("mm02-c", "Impact", "Impacto", "trending-down", [
                ("We're losing about ten percent of output.", "Estamos perdendo uns dez por cento da produção."),
                ("It could delay the shipment.", "Pode atrasar o envio."),
                ("There's no safety risk so far.", "Por enquanto não há risco de segurança."),
            ]),
            _b("mm02-d", "Next steps", "Próximos passos", "arrow-forward-circle", [
                ("We'll replace the sensor tomorrow.", "Vamos trocar o sensor amanhã."),
                ("I'll keep you posted.", "Vou te mantendo informado."),
                ("Can we check again on Friday?", "Podemos checar de novo na sexta?"),
            ]),
        ],
    },
    {
        "id": "mm03", "order": 3, "icon": "construct", "track": "work",
        "title_pt": "Na fábrica", "center_en": "On the shop floor", "center_pt": "No chão de fábrica",
        "branches": [
            _b("mm03-a", "Safety", "Segurança", "shield-checkmark", [
                ("Do I need safety glasses here?", "Preciso de óculos de segurança aqui?"),
                ("Where's the emergency exit?", "Onde fica a saída de emergência?"),
                ("Is the machine locked out?", "A máquina está bloqueada (lockout)?"),
            ]),
            _b("mm03-b", "Quality", "Qualidade", "ribbon", [
                ("This part is out of spec.", "Esta peça está fora de especificação."),
                ("How do you inspect it?", "Como vocês inspecionam isso?"),
                ("Let's check the measurement again.", "Vamos conferir a medida de novo."),
            ]),
            _b("mm03-c", "Production", "Produção", "cog", [
                ("What's the cycle time?", "Qual é o tempo de ciclo?"),
                ("How many shifts do you run?", "Quantos turnos vocês rodam?"),
                ("We're behind schedule this week.", "Estamos atrasados esta semana."),
            ]),
            _b("mm03-d", "Maintenance", "Manutenção", "build", [
                ("When was the last maintenance?", "Quando foi a última manutenção?"),
                ("We need a spare part.", "Precisamos de uma peça de reposição."),
                ("The pump is leaking.", "A bomba está vazando."),
            ]),
        ],
    },
    {
        "id": "mm04", "order": 4, "icon": "airplane", "track": "travel",
        "title_pt": "Viagem: aeroporto, hotel e transporte", "center_en": "Travel", "center_pt": "Viagem",
        "branches": [
            _b("mm04-a", "Airport", "Aeroporto", "airplane", [
                ("I'd like a window seat, please.", "Queria um assento na janela, por favor."),
                ("My flight was cancelled.", "Meu voo foi cancelado."),
                ("Where's the baggage claim?", "Onde fica a esteira de bagagens?"),
            ]),
            _b("mm04-b", "Immigration", "Imigração", "document-text", [
                ("I'm here for business meetings.", "Estou aqui para reuniões de negócios."),
                ("I'll be here for ten days.", "Vou ficar dez dias."),
                ("Here's my hotel reservation.", "Aqui está a reserva do meu hotel."),
            ]),
            _b("mm04-c", "Hotel", "Hotel", "bed", [
                ("I have a reservation under my name.", "Tenho uma reserva no meu nome."),
                ("What time is checkout?", "Que horas é o checkout?"),
                ("The Wi-Fi isn't working in my room.", "O Wi-Fi não está funcionando no meu quarto."),
            ]),
            _b("mm04-d", "Getting around", "Transporte", "car", [
                ("How long does it take to get to the plant?", "Quanto tempo leva para chegar à fábrica?"),
                ("Could you call me a taxi?", "Você pode chamar um táxi para mim?"),
                ("Please drop me off at the main gate.", "Por favor, me deixe no portão principal."),
            ]),
        ],
    },
    {
        "id": "mm05", "order": 5, "icon": "chatbubbles", "track": "work",
        "title_pt": "Small talk e comida", "center_en": "Small talk", "center_pt": "Conversa leve",
        "branches": [
            _b("mm05-a", "Starting", "Puxar conversa", "hand-left", [
                ("How's your week going?", "Como está sua semana?"),
                ("How long have you worked here?", "Há quanto tempo você trabalha aqui?"),
                ("Is this your first time in Brazil?", "É sua primeira vez no Brasil?"),
            ]),
            _b("mm05-b", "Keeping it going", "Manter a conversa", "repeat", [
                ("Oh really? How was it?", "Sério? Como foi?"),
                ("That sounds great!", "Parece ótimo!"),
                ("What about you?", "E você?"),
            ]),
            _b("mm05-c", "Food", "Comida", "restaurant", [
                ("What do you recommend?", "O que você recomenda?"),
                ("Is it spicy?", "É apimentado?"),
                ("I'm vegetarian.", "Sou vegetariano."),
            ]),
            _b("mm05-d", "Leaving", "Encerrar", "exit", [
                ("It was great talking to you.", "Foi ótimo conversar com você."),
                ("I'd better get back to work.", "É melhor eu voltar ao trabalho."),
                ("See you at the meeting.", "Te vejo na reunião."),
            ]),
        ],
    },
    {
        "id": "mm06", "order": 6, "icon": "flag", "track": "india",
        "title_pt": "Inglês indiano no trabalho", "center_en": "Indian English", "center_pt": "Inglês indiano",
        "branches": [
            _b("mm06-a", "Common expressions", "Expressões comuns", "chatbox-ellipses", [
                ("Please do the needful.", "Por favor, faça o necessário."),
                ("Kindly revert by Monday.", "Por favor, responda até segunda."),
                ("Can we prepone the meeting?", "Podemos antecipar a reunião?"),
            ]),
            _b("mm06-b", "Numbers", "Números", "calculator", [
                ("One lakh is one hundred thousand.", "Um lakh é cem mil."),
                ("Ten lakh is one million.", "Dez lakh é um milhão."),
                ("One crore is ten million.", "Um crore é dez milhões."),
            ]),
            _b("mm06-c", "Politeness", "Cortesia", "heart", [
                ("Good morning, sir.", "Bom dia, senhor."),
                ("Thank you so much, ma'am.", "Muito obrigado, senhora."),
                ("No problem, I'll take care of it.", "Sem problema, eu cuido disso."),
            ]),
            _b("mm06-d", "Yes, no or maybe", "Sim, não ou talvez", "help-buoy", [
                ("I will try my best.", "Vou fazer o possível (às vezes = provavelmente não)."),
                ("So, is that a yes for Friday?", "Então, isso é um sim para sexta?"),
                ("Can you confirm the date by email?", "Você pode confirmar a data por e-mail?"),
            ]),
        ],
    },
    {
        "id": "mm07", "order": 7, "icon": "snow", "track": "us",
        "title_pt": "Wisconsin e o Meio-Oeste", "center_en": "Wisconsin", "center_pt": "Wisconsin",
        "branches": [
            _b("mm07-a", "Local words", "Palavras locais", "chatbubble", [
                ("Where's the bubbler?", "Onde fica o bebedouro?"),
                ("Ope, sorry about that!", "Opa, desculpa!"),
                ("You betcha!", "Claro! / Com certeza!"),
            ]),
            _b("mm07-b", "Local food", "Comida local", "pizza", [
                ("I'd love to try cheese curds.", "Adoraria provar cheese curds."),
                ("Let's do a fish fry on Friday.", "Vamos num fish fry na sexta."),
                ("Have you been to a supper club?", "Você já foi a um supper club?"),
            ]),
            _b("mm07-c", "Winter", "Inverno", "snow", [
                ("Are the roads icy?", "As estradas estão com gelo?"),
                ("It's below zero today.", "Está abaixo de zero (°F) hoje."),
                ("I'm not used to this kind of cold.", "Não estou acostumado com esse tipo de frio."),
            ]),
            _b("mm07-d", "Midwest nice", "Jeito do Meio-Oeste", "happy", [
                ("That's an interesting idea.", "Ideia interessante (às vezes = não)."),
                ("Let's circle back on that.", "Vamos retomar isso depois."),
                ("Thanks for having me!", "Obrigado por me receberem!"),
            ]),
        ],
    },
    {
        "id": "mm08", "order": 8, "icon": "calculator", "track": "us",
        "title_pt": "Unidades e datas nos EUA", "center_en": "US units", "center_pt": "Unidades americanas",
        "branches": [
            _b("mm08-a", "Length", "Comprimento", "resize", [
                ("One inch is about twenty-five millimeters.", "Uma polegada tem uns 25 milímetros."),
                ("The tolerance is plus or minus five thou.", "A tolerância é de mais ou menos cinco milésimos de polegada."),
                ("One mile is about one point six kilometers.", "Uma milha tem cerca de 1,6 km."),
            ]),
            _b("mm08-b", "Weight and force", "Peso e força", "barbell", [
                ("It weighs about twelve pounds.", "Pesa umas 12 libras (≈ 5,4 kg)."),
                ("Torque it to forty foot-pounds.", "Aperte com 40 libras-pé (≈ 54 N·m)."),
                ("The line runs at eighty psi.", "A linha trabalha a 80 psi (≈ 5,5 bar)."),
            ]),
            _b("mm08-c", "Temperature", "Temperatura", "thermometer", [
                ("Thirty-two degrees is freezing.", "32 °F é o ponto de congelamento (0 °C)."),
                ("Seventy degrees is nice and warm.", "70 °F é agradável (≈ 21 °C)."),
                ("Keep the oven at three fifty.", "Mantenha o forno a 350 °F (≈ 177 °C)."),
            ]),
            _b("mm08-d", "Dates and time", "Datas e horário", "calendar", [
                ("Is that March fifth or May third?", "É 5 de março ou 3 de maio?"),
                ("The meeting is at nine a.m. Central Time.", "A reunião é às 9h, horário central."),
                ("That's noon in Brazil.", "Isso é meio-dia no Brasil (no inverno americano; no verão, 11h)."),
            ]),
        ],
    },
]

TRACKS_PT: dict[str, str] = {"work": "Trabalho", "travel": "Viagem", "india": "Índia", "us": "Wisconsin / EUA"}


def map_summary(m: dict) -> dict:
    return {"id": m["id"], "order": m["order"], "icon": m["icon"], "track": m["track"], "title_pt": m["title_pt"],
            "center_en": m["center_en"], "center_pt": m["center_pt"],
            "branch_count": len(m["branches"]), "leaf_count": sum(len(b["leaves"]) for b in m["branches"])}


def get_map(map_id: str) -> dict | None:
    return next((m for m in MAPS if m["id"] == map_id), None)


def leaves(m: dict) -> list[dict]:
    return [leaf for b in m["branches"] for leaf in b["leaves"]]
