"""Guia "Como eles falam": pronúncia, fala do dia a dia, gírias, estilo de conversa e sotaques (Índia e EUA/Wisconsin).

Objetivo: ENTENDER o que colegas indianos e americanos dizem, não imitar o sotaque.
Cada item tem uma frase em inglês (com áudio gravado), o significado e uma dica. "fast" é uma grafia aproximada de
como a frase soa na fala rápida (lida pela voz gravada, só como aproximação). Expressões regionais são marcadas como
regionais: nem todo mundo fala assim. Conteúdo original, escrito para este app.
"""

from __future__ import annotations


def _items(prefix: str, rows: list[tuple]) -> list[dict]:
    out = []
    for k, row in enumerate(rows, start=1):
        en, pt, note = row[0], row[1], row[2]
        item = {"id": f"{prefix}{k:02d}", "en": en, "pt": pt, "note_pt": note}
        if len(row) > 3 and row[3]:
            item["sounds_pt"] = row[3]
        if len(row) > 4 and row[4]:
            item["fast"] = row[4]
        out.append(item)
    return out


GUIDES: list[dict] = [
    {
        "code": "IN", "accent": "IN", "title_pt": "Índia", "icon": "flag",
        "intro_pt": ("No trabalho, o inglês indiano é fluente e rápido, com ritmo próprio e palavras do hindi e de outras "
                     "línguas no meio. Brasileiros têm vantagem: vogais simples, 'r' batido e p/t/k sem sopro são parecidos "
                     "com o português. O desafio é a velocidade, as expressões e o estilo indireto."),
        "sections": [
            {"id": "pron", "icon": "mic", "title_pt": "Pronúncia: como soa",
             "intro_pt": "O que muda no som. Ouça a frase e leia como ela costuma soar.",
             "items": _items("in-p", [
                 ("We will verify the vendor's invoice.", "Vamos verificar a nota do fornecedor.",
                  "V e W viram um som parecido: se não fizer sentido com 'v', tente com 'w'.", "uí uill wérifai de wendors inwoice"),
                 ("Three thousand three hundred.", "Três mil e trezentos.",
                  "'Th' vira t/d: 'three' soa como 'tree'. Cuidado com números!", "tri táuzend tri hândred"),
                 ("The data is in the total.", "O dado está no total.",
                  "T e D 'duros', com a língua curvada para trás (retroflexos). Continuam fáceis de reconhecer pelo contexto.", None),
                 ("I am going to the office.", "Estou indo para o escritório.",
                  "Ritmo de sílabas iguais e menos contrações: 'I am', 'do not'. Soa mais 'cheio' que o americano.", "ai-em-gô-ing-tu-di-ó-fis"),
                 ("Please share the schedule.", "Por favor, compartilhe o cronograma.",
                  "'Schedule' à britânica: 'shédiul' (nos EUA: 'skédjul').", "plíz xér de xédiul"),
                 ("My number is nine eight double five, triple two.", "Meu número é 9-8-5-5-2-2-2.",
                  "Números de telefone com 'double' e 'triple'. Anote enquanto ouve.", None),
                 ("Is it Z for zebra?", "É Z de zebra?",
                  "A letra Z se chama 'zed' (britânico), não 'zee'.", "is it zéd for zíbra"),
                 ("Today we will discuss the development plan.", "Hoje vamos discutir o plano de desenvolvimento.",
                  "A sílaba forte pode mudar de lugar: 'DE-ve-lop-ment' em vez de 'de-VE-lop-ment'.", None),
                 ("The meeting is at eleven thirty.", "A reunião é às onze e meia.",
                  "Fala rápida e entonação que sobe e desce bastante. Peça: 'Could you say that a bit slowly?'", None),
             ])},
            {"id": "daily", "icon": "chatbubbles", "title_pt": "Jeito de falar no dia a dia",
             "intro_pt": "Construções comuns no inglês indiano que confundem quem aprendeu o inglês dos livros.",
             "items": _items("in-d", [
                 ("You are coming tomorrow, no?", "Você vem amanhã, né?",
                  "'no?' ou 'na?' no fim = 'né?'. Perguntas também vêm sem inverter: 'You are coming?'"),
                 ("You will send it today, isn't it?", "Você manda hoje, né?",
                  "'isn't it?' serve para qualquer frase (não muda para 'won't you?')."),
                 ("I will send it today only.", "Mando hoje mesmo.", "'only' dá ênfase: 'today only' = hoje mesmo."),
                 ("He is sitting here itself.", "Ele está sentado aqui mesmo.", "'itself' também enfatiza: 'here itself' = aqui mesmo."),
                 ("Tell me.", "Pode falar / Diga.", "Ao atender o telefone, 'Tell me' quer dizer 'pode falar', não é grosseria."),
                 ("I have a small doubt.", "Tenho uma pequena dúvida (pergunta).", "'Doubt' = pergunta, não desconfiança."),
                 ("What is your good name?", "Qual é o seu nome?", "Forma educada e tradicional de perguntar o nome."),
                 ("Do one thing: send me the file first.", "Faz o seguinte: me manda o arquivo primeiro.",
                  "'Do one thing' introduz uma sugestão."),
                 ("He is out of station this week.", "Ele está viajando (fora da cidade) esta semana.", "'Out of station' = fora da cidade."),
                 ("Please revert by evening.", "Por favor, responda até o fim do dia.", "'Revert' = responder (não 'reverter')."),
                 ("Can we prepone the call?", "Podemos antecipar a call?", "'Prepone' = o contrário de 'postpone'."),
                 ("Give me two minutes.", "Me dá um minutinho.", "'Two minutes' = 'um instante', não exatamente dois minutos."),
             ])},
            {"id": "slang", "icon": "happy", "title_pt": "Gírias e palavras do hindi no meio",
             "intro_pt": ("Entre colegas, é comum misturar palavras do hindi ('Hinglish'), principalmente no norte e no oeste. "
                          "No sul (Chennai, Bangalore, Hyderabad) aparecem menos palavras do hindi e mais das línguas locais."),
             "items": _items("in-s", [
                 ("Acha, okay, I'll do it.", "Ah, tá, eu faço.", "'Acha' (atchá) = 'tá / entendi / é mesmo?', depende da entonação."),
                 ("Chalo, let's start the meeting.", "Bora, vamos começar a reunião.", "'Chalo' (tchalô) = 'vamos / bora'. Também encerra conversa."),
                 ("Arre, no problem, yaar!", "Ah, sem problema, cara!", "'Arre' = 'ah / opa'; 'yaar' = 'cara, amigo' (informal)."),
                 ("Haan, I'm listening.", "Sim, estou ouvindo.", "'Haan' (rrãn) = 'sim'. 'Nahi' = 'não'."),
                 ("Bas, that's all for today.", "Só isso por hoje.", "'Bas' (bâs) = 'só / chega / é isso'."),
                 ("Pakka, I'll send it by five.", "Com certeza, mando até as cinco.", "'Pakka' (pâká) = 'certeza / combinado'."),
                 ("That's a smart jugaad.", "Que gambiarra esperta.", "'Jugaad' (djugárd) = solução improvisada e criativa."),
                 ("Sharma-ji will join the call.", "O senhor Sharma vai entrar na call.", "'-ji' depois do nome = respeito (como 'seu' ou 'dona')."),
                 ("Don't take tension, I'll handle it.", "Não se preocupe, eu resolvo.", "'Tension' = preocupação, estresse."),
                 ("It was just timepass.", "Foi só para passar o tempo.", "'Timepass' = passatempo, algo sem importância."),
                 ("Thik hai, see you tomorrow.", "Tá bom, até amanhã.", "'Thik hai' (tík rrái) = 'tá bom / ok'."),
             ])},
            {"id": "style", "icon": "people", "title_pt": "Como eles conversam",
             "intro_pt": "Estilo e etiqueta. Saber isso evita mal-entendidos maiores do que qualquer erro de gramática.",
             "items": _items("in-c", [
                 ("Yes, yes, it will be done.", "Sim, sim, vai ser feito.",
                  "'Yes' pode significar 'estou ouvindo', não um compromisso. Confirme o prazo por e-mail."),
                 ("We will try our level best.", "Vamos fazer o máximo possível.",
                  "Pode ser um 'não' educado. Pergunte: 'So, can we commit to Friday?'"),
                 ("Sir, one small request.", "Senhor, um pequeno pedido.", "Pedidos costumam vir com 'one small request' e 'sir/ma'am'."),
                 ("Hello? Am I audible?", "Alô? Vocês estão me ouvindo?", "Muito comum em calls: 'Am I audible?' = está me ouvindo?"),
                 ("Please be on the line.", "Por favor, aguarde na linha.", "Ao telefone: 'be on the line' = não desligue."),
                 ("Have you had lunch?", "Você já almoçou?", "Pergunta de cuidado, faz parte da conversa leve. Responda e devolva."),
                 ("Are you married? How many kids?", "Você é casado? Quantos filhos?",
                  "Perguntas pessoais cedo são simpatia, não invasão. Responda o que quiser."),
                 ("Sorry for the delay, there was a power cut.", "Desculpe a demora, faltou luz.", "'Power cut' (britânico) = falta de luz."),
                 ("Kindly do the needful.", "Por favor, providencie o necessário.", "Típico de e-mail formal. Responda dizendo o que vai fazer."),
             ])},
        ],
        "accents": [
            {"title_pt": "Norte (Delhi, Punjab)", "text_pt": "Mais palavras do hindi no meio, 'v/w' parecidos, ritmo rápido."},
            {"title_pt": "Oeste (Mumbai, Pune)", "text_pt": "Mistura de hindi e marathi; inglês muito usado em empresas e na cidade."},
            {"title_pt": "Sul (Bangalore, Chennai, Hyderabad)", "text_pt": "Menos hindi; t/d bem retroflexos e entonação marcada. Grande centro de tecnologia: você vai ouvir muito este sotaque em calls."},
            {"title_pt": "Leste (Kolkata)", "text_pt": "Influência do bengali: algumas vogais mais abertas e 'v' que soa como 'bh'."},
        ],
        "listening_tips": [
            "Foque nas palavras-chave (números, datas, nomes, verbos) e não em cada palavra.",
            "Nomes indianos: peça para soletrar ('Could you spell your name?') e anote.",
            "Confirme números e prazos repetindo: 'So, three-three-zero, by Friday, right?'",
            "Na primeira semana tudo parece rápido; o ouvido se acostuma com 2–3 semanas de exposição diária.",
        ],
    },
    {
        "code": "US", "accent": "US", "title_pt": "EUA (Wisconsin)", "icon": "snow",
        "intro_pt": ("Os americanos encurtam e juntam as palavras na fala rápida ('gonna', 'whaddaya'), usam muitas expressões "
                     "de escritório e, no Meio-Oeste, são simpáticos e indiretos. Wisconsin tem um sotaque próprio (o do "
                     "'Upper Midwest'), mas no trabalho você também vai ouvir pessoas de outras regiões."),
        "sections": [
            {"id": "pron", "icon": "mic", "title_pt": "Pronúncia: como soa",
             "intro_pt": "As mudanças de som que mais atrapalham a compreensão do inglês americano.",
             "items": _items("us-p", [
                 ("Can I get some water?", "Pode me dar um pouco de água?",
                  "O 't' entre vogais vira um 'r' rápido: 'water' soa como 'wárer'.", "ken ai guéd sâm wárer", "Can I get some wadder?"),
                 ("It's a better bottle.", "É uma garrafa melhor.", "Mesmo efeito: 'better' = 'bérer', 'bottle' = 'bárou'.",
                  "its a bérer bárou", "It's a bedder baddle."),
                 ("Did you eat yet?", "Você já comeu?", "Na fala rápida vira uma palavra só: 'Jeet yet?'", "djit iét", "Jeet yet?"),
                 ("What do you want to do?", "O que você quer fazer?", "'What do you' = 'whaddaya'; 'want to' = 'wanna'.",
                  "uárarrâ uána du", "Whaddaya wanna do?"),
                 ("I'm going to call him.", "Vou ligar para ele.", "'going to' = 'gonna'; 'him' perde o 'h': 'call 'im'.",
                  "aim gâna kól im", "I'm gonna call 'im."),
                 ("I've got to go.", "Tenho que ir.", "'got to' = 'gotta'.", "aiv gára gou", "I gotta go."),
                 ("I can go, but I can't stay.", "Posso ir, mas não posso ficar.",
                  "'can' é fraco (kn) e 'can't' é forte, com o 't' quase mudo. Preste atenção na força da palavra.", None, None),
                 ("There are twenty people on the internet call.", "Há vinte pessoas na call.",
                  "Depois de 'n', o 't' some: 'twenny', 'innernet'.", "dér ar tuéni pípou", "There're twenny people on the innernet call."),
                 ("Grab your bag and the flag.", "Pegue sua bolsa e a bandeira.",
                  "Em Wisconsin, o 'a' antes de 'g' soa quase como 'ei': 'bag' = 'bêig'.", "gréib iór bêig end de flêig", None),
                 ("Let's go to the boat.", "Vamos para o barco.", "No Upper Midwest, 'go' e 'boat' soam com 'ô' puro, como em português.",
                  "léts gô tu de bôt", None),
                 ("I live in Milwaukee.", "Moro em Milwaukee.", "Muitos locais dizem algo como 'm'WAW-kee', quase sem o 'l'.",
                  "ai liv in muóki", None),
             ])},
            {"id": "daily", "icon": "chatbubbles", "title_pt": "Fala do dia a dia",
             "intro_pt": "Expressões curtas que aparecem o tempo todo no escritório e na rua.",
             "items": _items("us-d", [
                 ("How's it going?", "Tudo bem?", "Não é uma pergunta de verdade. Responda curto: 'Good, you?'"),
                 ("What's up?", "E aí?", "Resposta comum: 'Not much, you?'"),
                 ("I'm gonna grab a coffee. Want anything?", "Vou pegar um café. Quer algo?", "'Grab' = pegar, comprar rápido."),
                 ("Sounds good.", "Combinado / Ótimo.", "Para aceitar um plano ou horário."),
                 ("No worries.", "Sem problema / De nada.", "Resposta a 'sorry' ou 'thanks'."),
                 ("My bad.", "Foi mal.", "Pedido de desculpas informal por um erro pequeno."),
                 ("I'll shoot you an email.", "Vou te mandar um e-mail.", "'Shoot' = mandar rápido."),
                 ("Can you give me a ballpark?", "Você pode me dar uma estimativa?", "'Ballpark' = número aproximado."),
                 ("Just a heads-up, the meeting moved to three.", "Só um aviso: a reunião mudou para as três.", "'Heads-up' = aviso prévio."),
                 ("Let's take this offline.", "Vamos falar disso depois, fora da reunião.", "Não tem nada a ver com internet."),
                 ("I'm swamped this week.", "Estou atolado esta semana.", "'Swamped' = cheio de trabalho."),
                 ("Hang on a sec.", "Espera um segundo.", "'Sec' = second."),
             ])},
            {"id": "slang", "icon": "happy", "title_pt": "Gírias e jeito de Wisconsin",
             "intro_pt": "Palavras e expressões regionais do Upper Midwest. Entenda todas; use só as que soarem naturais para você.",
             "items": _items("us-s", [
                 ("Ope, sorry!", "Opa, desculpa!", "'Ope' sai ao esbarrar ou passar na frente de alguém."),
                 ("Where's the bubbler?", "Onde fica o bebedouro?", "'Bubbler' = bebedouro (bem típico de Wisconsin)."),
                 ("You betcha!", "Claro! / Com certeza!", "Simpático, mas usar demais soa forçado para quem é de fora."),
                 ("Are you coming with?", "Você vem junto?", "No Upper Midwest a frase termina em 'with', sem 'us'."),
                 ("Uff da, that's a lot of snow!", "Nossa, quanta neve!", "'Uff da' (de origem norueguesa) = 'nossa / eita'. Regional."),
                 ("Let's grab some brats.", "Vamos comer umas salsichas (bratwurst).", "'Brat' aqui se diz 'bráht' e é a salsicha alemã."),
                 ("We're going up north this weekend.", "Vamos para o norte (lagos e cabanas) neste fim de semana.",
                  "'Up north' = a região de lagos e cabanas no norte do estado."),
                 ("What's for supper?", "O que tem para o jantar?", "'Supper' é comum no Meio-Oeste para o jantar."),
                 ("He's a total cheesehead.", "Ele é um torcedor fanático dos Packers.", "'Cheesehead' = apelido carinhoso de torcedor / pessoa de Wisconsin."),
                 ("Turn left at the stop-and-go lights.", "Vire à esquerda no semáforo.", "Alguns locais dizem 'stop-and-go lights' para semáforo. Regional."),
             ])},
            {"id": "style", "icon": "people", "title_pt": "Como eles conversam",
             "intro_pt": "Estilo, etiqueta e o famoso 'Midwest nice'.",
             "items": _items("us-c", [
                 ("Hi, I'm Mike. Nice to meet you.", "Oi, sou o Mike. Prazer.", "Primeiro nome com todo mundo, inclusive chefes."),
                 ("That's an interesting idea…", "É uma ideia interessante…", "No Meio-Oeste pode ser um 'não' educado. Pergunte o que precisaria mudar."),
                 ("Thanks so much, I really appreciate it!", "Muito obrigado, agradeço de verdade!", "Muitos agradecimentos e elogios fazem parte do tom."),
                 ("Do you have a minute?", "Você tem um minuto?", "Pergunte antes de interromper alguém."),
                 ("Crazy weather, huh?", "Que tempo maluco, né?", "Assuntos seguros: clima, esportes, fim de semana. Evite política, religião e salário."),
                 ("Sorry, I didn't catch that.", "Desculpe, não entendi.", "Pedir para repetir é normal; ninguém se incomoda."),
                 ("Well, I should let you go.", "Bom, vou te deixar ir.", "Sinal de que a conversa está acabando (a 'despedida longa' do Meio-Oeste)."),
                 ("Not bad at all!", "Nada mal!", "Elogio de verdade, mais contido."),
                 ("I'm running five minutes late.", "Vou atrasar cinco minutos.", "Reuniões começam na hora; avise se for atrasar."),
             ])},
        ],
        "accents": [
            {"title_pt": "Upper Midwest (Wisconsin, Minnesota)", "text_pt": "'ô' e 'ê' puros (parecidos com o português), 'bag' como 'bêig' e um tom simpático e cantado."},
            {"title_pt": "Milwaukee e Chicago", "text_pt": "Vogais diferentes nas cidades grandes da região ('a' mais fechado). Fala rápida."},
            {"title_pt": "'General American'", "text_pt": "O sotaque da TV e de muitos colegas de outras regiões: 't' entre vogais como 'r' rápido e muitas reduções ('gonna', 'wanna')."},
            {"title_pt": "Sul dos EUA", "text_pt": "Se aparecer alguém do sul: fala mais arrastada e 'y'all' (vocês)."},
        ],
        "listening_tips": [
            "Aprenda as formas reduzidas (gonna, wanna, gotta, lemme, whaddaya): elas são a maior barreira para entender.",
            "Preste atenção na sílaba forte: 'can' fraco = pode; 'can't' forte = não pode.",
            "Em calls, peça para confirmar por escrito o que for importante: 'Could you drop that in the chat?'",
            "Assistir séries com legenda em inglês ajuda a ligar o som rápido à palavra escrita.",
        ],
    },
]


def guide_for(code: str) -> dict | None:
    return next((g for g in GUIDES if g["code"] == code.upper()), None)


def guide_items(g: dict) -> list[dict]:
    return [i for s in g["sections"] for i in s["items"]]


def guide_summary(g: dict) -> dict:
    return {"code": g["code"], "title_pt": g["title_pt"], "icon": g["icon"], "accent": g["accent"],
            "sections": [{"id": s["id"], "title_pt": s["title_pt"], "icon": s["icon"], "count": len(s["items"])} for s in g["sections"]],
            "item_count": len(guide_items(g))}
