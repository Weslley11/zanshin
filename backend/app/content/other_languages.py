"""Trilhas iniciais (Fase E) de espanhol, italiano, mandarim e japonês.

Cada idioma tem estratégia própria (ver languages.py). Aqui está o conteúdo semente de
vocabulário (com repetição espaçada) e drills específicos: falsos amigos (ES), consoantes
duplas (IT), pares de tons (ZH) e kana/partículas/formalidade (JA).
Formato de vocabulário: (termo, tipo, significado_pt, exemplo, domínio, CEFR, prioridade, pronúncia)
"""

from __future__ import annotations

VOCAB_ES: list[tuple] = [
    ("¿Podría repetirlo, por favor?", "phrase", "Poderia repetir, por favor?", "Perdón, ¿podría repetirlo, por favor?", "conversation", "A1", 10, ""),
    ("Tengo una reserva a nombre de…", "travel", "Tenho uma reserva no nome de…", "Hola, tengo una reserva a nombre de Ribeiro.", "travel", "A2", 11, ""),
    ("¿Me trae la cuenta?", "travel", "Pode trazer a conta?", "Disculpe, ¿me trae la cuenta, por favor?", "travel", "A2", 12, ""),
    ("plazo", "corporate", "prazo", "El plazo de entrega es de seis semanas.", "corporate", "B1", 20, ""),
    ("pieza / repuesto", "technical", "peça / peça de reposição", "Necesitamos un repuesto para la bomba.", "engineering", "B1", 21, ""),
    ("plano (técnico)", "technical", "desenho técnico", "Revisa el plano antes de enviarlo a producción.", "engineering", "B1", 22, ""),
    ("tornillo / tuerca / arandela", "technical", "parafuso / porca / arruela", "Falta una arandela en el montaje.", "engineering", "B1", 23, ""),
    ("taller", "word", "oficina (mecânica) / workshop", "Llevé el coche al taller.", "general", "A2", 24, ""),
    ("oficina", "false_friend", "escritório (NÃO é oficina mecânica)", "Trabajo en una oficina en el centro.", "general", "A2", 13, ""),
    ("exquisito", "false_friend", "delicioso, refinado (NÃO é esquisito)", "La comida estaba exquisita.", "general", "B1", 14, ""),
    ("embarazada", "false_friend", "grávida (NÃO é envergonhada = avergonzada)", "Mi hermana está embarazada.", "general", "B1", 15, ""),
    ("polvo", "false_friend", "pó, poeira (polvo = pulpo)", "Hay mucho polvo en la máquina.", "general", "B1", 16, ""),
    ("borracha", "false_friend", "bêbada (borracha = goma)", "No conduzcas si estás borracho.", "general", "B1", 17, ""),
    ("pronto", "false_friend", "logo, em breve (pronto = listo)", "Te llamo pronto.", "general", "A2", 18, ""),
    ("apellido", "false_friend", "sobrenome (apelido = apodo)", "¿Cuál es su apellido?", "general", "A2", 19, ""),
    ("vosotros / ustedes", "word", "vocês (Espanha / América Latina)", "¿Vosotros venís mañana? / ¿Ustedes vienen mañana?", "conversation", "A2", 25, ""),
]

VOCAB_IT: list[tuple] = [
    ("Può ripetere, per favore?", "phrase", "Pode repetir, por favor? (formal, Lei)", "Scusi, può ripetere, per favore?", "conversation", "A1", 10, ""),
    ("Vorrei…", "phrase", "Eu gostaria… (pedido educado)", "Vorrei un caffè, per favore.", "travel", "A1", 11, ""),
    ("Ho una prenotazione a nome di…", "travel", "Tenho uma reserva no nome de…", "Buonasera, ho una prenotazione a nome di Ribeiro.", "travel", "A2", 12, ""),
    ("il conto", "travel", "a conta", "Ci porta il conto, per favore?", "travel", "A1", 13, ""),
    ("nonno / nono", "pronunciation", "avô / nono (consoante dupla muda o sentido)", "Mio nonno è il nono di dieci figli.", "pronunciation", "A2", 14, "nòn-no × nò-no"),
    ("palla / pala", "pronunciation", "bola / pá", "La palla è sulla pala.", "pronunciation", "A2", 15, "pàl-la × pà-la"),
    ("carro / caro", "pronunciation", "carroça / caro", "Il carro è molto caro.", "pronunciation", "A2", 16, "càr-ro × cà-ro"),
    ("scadenza", "corporate", "prazo / vencimento", "La scadenza è venerdì.", "corporate", "B1", 20, ""),
    ("disegno tecnico", "technical", "desenho técnico", "Il disegno tecnico è alla revisione B.", "engineering", "B1", 21, ""),
    ("distinta base", "technical", "lista de materiais (BOM)", "Manca una vite nella distinta base.", "engineering", "B2", 22, ""),
    ("Lei / tu", "word", "você formal / você informal", "Lei è l'ingegnere nuovo? / Tu sei di Milano?", "conversation", "A1", 17, ""),
    ("sono andato / ho fatto", "word", "passato prossimo com essere × avere", "Ieri sono andato in ufficio e ho fatto una riunione.", "grammar", "A2", 18, ""),
]

VOCAB_ZH: list[tuple] = [
    ("你好", "phrase", "olá", "你好！我叫卫斯理。", "conversation", "A1", 10, "nǐ hǎo (3º+3º → 2º+3º: ní hǎo)"),
    ("谢谢", "phrase", "obrigado", "谢谢你的帮助。", "conversation", "A1", 11, "xièxie"),
    ("请再说一遍", "phrase", "por favor, repita", "对不起，请再说一遍。", "conversation", "A1", 12, "qǐng zài shuō yí biàn"),
    ("我听不懂", "phrase", "não entendo (ouvindo)", "对不起，我听不懂。", "conversation", "A1", 13, "wǒ tīng bu dǒng"),
    ("多少钱？", "travel", "quanto custa?", "这个多少钱？", "travel", "A1", 14, "duōshao qián"),
    ("工程师", "word", "engenheiro", "我是机械工程师。", "engineering", "A2", 20, "gōngchéngshī"),
    ("开会", "word", "fazer reunião", "我们下午三点开会。", "corporate", "A2", 21, "kāi huì"),
    ("零件", "technical", "peça, componente", "这个零件有问题。", "engineering", "B1", 22, "língjiàn"),
    ("个 (classificador)", "word", "classificador geral", "一个人，三个零件。", "grammar", "A1", 15, "gè"),
    ("妈 / 麻 / 马 / 骂", "pronunciation", "mãe / cânhamo / cavalo / xingar (4 tons)", "妈妈骂马。", "pronunciation", "A1", 9, "mā / má / mǎ / mà"),
]

VOCAB_JA: list[tuple] = [
    ("おはようございます", "phrase", "bom dia (formal)", "おはようございます。今日もよろしくお願いします。", "conversation", "A1", 10, "ohayō gozaimasu"),
    ("よろしくお願いします", "phrase", "conto com você / prazer (fórmula essencial no trabalho)", "はじめまして、リベイロです。よろしくお願いします。", "corporate", "A1", 11, "yoroshiku onegai shimasu"),
    ("もう一度お願いします", "phrase", "mais uma vez, por favor", "すみません、もう一度お願いします。", "conversation", "A1", 12, "mō ichido onegai shimasu"),
    ("すみません", "phrase", "com licença / desculpe", "すみません、駅はどこですか。", "conversation", "A1", 13, "sumimasen"),
    ("いくらですか", "travel", "quanto custa?", "これはいくらですか。", "travel", "A1", 14, "ikura desu ka"),
    ("会議", "word", "reunião", "三時から会議があります。", "corporate", "A2", 20, "かいぎ (kaigi)"),
    ("部品", "technical", "peça, componente", "この部品は不良です。", "engineering", "B1", 21, "ぶひん (buhin)"),
    ("図面", "technical", "desenho técnico", "図面を確認してください。", "engineering", "B1", 22, "ずめん (zumen)"),
    ("は / が", "grammar", "partícula de tópico × de sujeito", "私はエンジニアです。/ 誰が来ましたか。", "grammar", "A1", 15, "wa / ga"),
    ("おばさん / おばあさん", "pronunciation", "tia / avó (vogal longa muda o sentido)", "おばあさんは元気です。", "pronunciation", "A1", 16, "obasan × obāsan"),
    ("来て / 切って", "pronunciation", "venha / corte (consoante geminada)", "ここに来てください。", "pronunciation", "A2", 17, "kite × kitte"),
]

HIRAGANA_BASIC = list("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん")
KATAKANA_BASIC = list("アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン")

ZH_TONE_PAIRS = [
    {"pair": "1-1", "example": "飞机", "pinyin": "fēijī", "meaning_pt": "avião"},
    {"pair": "1-4", "example": "工作", "pinyin": "gōngzuò", "meaning_pt": "trabalho"},
    {"pair": "2-1", "example": "明天", "pinyin": "míngtiān", "meaning_pt": "amanhã"},
    {"pair": "3-4", "example": "比赛", "pinyin": "bǐsài", "meaning_pt": "competição"},
    {"pair": "4-4", "example": "电话", "pinyin": "diànhuà", "meaning_pt": "telefone"},
    {"pair": "3-3", "example": "你好", "pinyin": "nǐhǎo → níhǎo", "meaning_pt": "olá (sandhi do 3º tom)"},
]

SHADOWING_OTHER: dict[str, list[dict]] = {
    "es": [
        {"id": "sh-es-1", "level": "A2", "accent": "ES", "text": "Perdón, ¿podría hablar un poco más despacio?", "focus_pt": "Vogais orais (sem nasalizar 'perdón'); 'despacio' com 's' claro."},
        {"id": "sh-es-2", "level": "B1", "accent": "MX", "text": "Tenemos que revisar el plano antes de mandarlo a producción.", "focus_pt": "'r' simples entre vogais e 'rr' vibrante; ritmo silábico."},
    ],
    "it": [
        {"id": "sh-it-1", "level": "A2", "accent": "IT", "text": "Vorrei un caffè e un cornetto, per favore.", "focus_pt": "Consoantes duplas: caffè, cornetto — segure a consoante."},
        {"id": "sh-it-2", "level": "B1", "accent": "IT", "text": "La riunione è stata spostata a domani mattina.", "focus_pt": "'stata spostata' — sem vogal de apoio antes do 's' (não 'estata')."},
    ],
    "zh": [
        {"id": "sh-zh-1", "level": "A1", "accent": "CN", "text": "你好，我是巴西来的工程师。", "focus_pt": "nǐ hǎo → ní hǎo; 'gōngchéngshī' 1º-2º-1º tons."},
        {"id": "sh-zh-2", "level": "A2", "accent": "CN", "text": "请再说一遍，好吗？", "focus_pt": "'yí biàn' — 一 muda para 2º tom antes de 4º tom."},
    ],
    "ja": [
        {"id": "sh-ja-1", "level": "A1", "accent": "JP", "text": "はじめまして。ブラジルから来ました。", "focus_pt": "Ritmo moraico: cada mora com a mesma duração; 'kimashita' com 'i' quase mudo."},
        {"id": "sh-ja-2", "level": "A2", "accent": "JP", "text": "すみません、もう一度お願いします。", "focus_pt": "'mō' vogal longa; 'onegai shimasu' com 'su' final reduzido."},
    ],
}

QUICK_RESPONSE_OTHER: dict[str, list[dict]] = {
    "es": [
        {"id": "qr-es-1", "level": "A2", "theme": "personal", "q": "¿A qué te dedicas?", "keywords": ["soy", "trabajo", "ingeniero"], "model": "Soy ingeniero mecánico."},
        {"id": "qr-es-2", "level": "B1", "theme": "work", "q": "¿Qué hiciste el fin de semana?", "keywords": ["fui", "hice", "estuve", "vi"], "model": "Fui a la playa con mi familia."},
    ],
    "it": [
        {"id": "qr-it-1", "level": "A2", "theme": "personal", "q": "Di dove sei?", "keywords": ["sono", "brasile", "di"], "model": "Sono brasiliano, di San Paolo."},
        {"id": "qr-it-2", "level": "B1", "theme": "work", "q": "Che lavoro fai?", "keywords": ["sono", "lavoro", "ingegnere"], "model": "Sono ingegnere e lavoro nella progettazione."},
    ],
    "zh": [
        {"id": "qr-zh-1", "level": "A1", "theme": "personal", "q": "你叫什么名字？", "keywords": ["我叫", "我是"], "model": "我叫卫斯理。"},
        {"id": "qr-zh-2", "level": "A2", "theme": "personal", "q": "你做什么工作？", "keywords": ["工程师", "我是", "工作"], "model": "我是工程师。"},
    ],
    "ja": [
        {"id": "qr-ja-1", "level": "A1", "theme": "personal", "q": "お名前は何ですか。", "keywords": ["です", "と申します"], "model": "リベイロです。"},
        {"id": "qr-ja-2", "level": "A2", "theme": "personal", "q": "お仕事は何ですか。", "keywords": ["エンジニア", "です"], "model": "エンジニアです。"},
    ],
}

VOCAB_BY_LANGUAGE = {"es": VOCAB_ES, "it": VOCAB_IT, "zh": VOCAB_ZH, "ja": VOCAB_JA}
