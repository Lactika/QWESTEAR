/*
 * 25 уровней «Мишутка и заброшенный лес».
 * Механики:
 *  1. Предметы и комбинации (ключ, лом, верёвка)
 *  2. Связанные выключатели («гирлянда»: переключение соседей)
 *  3. Последовательность рычагов по символам-подсказкам
 *  4. Код на панели из подсказок в окружении
 *  5. Лампа и тень: положение лампы открывает проход
 *  6. Смешанные: скрытые предметы, комбинации механик
 *
 * Поля хотспота: id, kind (pickup|door|switch|lever|keypad|clue|decor),
 * x — позиция по горизонтали (0..960), label — подпись для игрока.
 * solve — проверенная последовательность ходов (строки id или {id, code}).
 */
(function (root) {
  const LEVELS = [
    // ---------- 1. Предметы ----------
    {
      id: 1, title: 'Тёплая хижина', mech: 'items', palette: 'dusk',
      intro: 'Мишутка проснулся в хижине. Надо выбраться в лес.',
      hint: 'Ключ лежит на видном месте — на столе. Дверь откроется, когда он будет у Мишутки.',
      hotspots: [
        { id: 'key', x: 200, kind: 'pickup', item: 'key', label: 'Ключ', msg: 'Тяжёлый ржавый ключ.' },
        { id: 'poster', x: 470, kind: 'clue', label: 'Записка', text: 'Дверь заперта. Ключ всегда там, где его видно.' },
        { id: 'door', x: 780, kind: 'door', label: 'Дверь', exit: true, needs: [{ item: 'key' }],
          lockedMsg: 'Заперто. Нужен ключ.', exitMsg: 'Щёлк! Мишутка выходит в лес.' },
      ],
      solve: ['key', 'door'],
    },
    {
      id: 2, title: 'Сундук в сарае', mech: 'items', palette: 'dusk',
      intro: 'В сарае заперт сундук, а ключ внутри него.',
      hint: 'Сначала нужен инструмент. Сундук откроется только с ломом.',
      hotspots: [
        { id: 'crowbar', x: 110, kind: 'pickup', item: 'crowbar', label: 'Лом' },
        { id: 'chest', x: 360, kind: 'door', label: 'Сундук', needs: [{ item: 'crowbar' }],
          lockedMsg: 'Крышка не поддаётся.', openMsg: 'Крышка откинута!', openAgainMsg: 'Внутри пусто, кроме ключа.' },
        { id: 'key', x: 430, kind: 'pickup', item: 'key', label: 'Ключ', visibleIf: [{ is: ['chest', 'open'] }] },
        { id: 'gate', x: 820, kind: 'door', label: 'Ворота', exit: true, needs: [{ item: 'key' }],
          lockedMsg: 'Замок. Нужен ключ.', exitMsg: 'Ворота скрипнули и открылись.' },
      ],
      solve: ['crowbar', 'chest', 'key', 'gate'],
    },
    {
      id: 3, title: 'Щиток', mech: 'items', palette: 'dusk',
      intro: 'Щиток без света. Нужна пара вещей.',
      hint: 'Щиток работает от предохранителя и батарейки. Камень здесь ни при чём.',
      hotspots: [
        { id: 'fuse', x: 120, kind: 'pickup', item: 'fuse', label: 'Предохранитель' },
        { id: 'rock', x: 300, kind: 'pickup', item: 'rock', label: 'Камень', msg: 'Обычный камень. Пригодится, наверное, как-нибудь.' },
        { id: 'battery', x: 580, kind: 'pickup', item: 'battery', label: 'Батарейка' },
        { id: 'note', x: 450, kind: 'clue', label: 'Табличка', text: 'Щиток: нужен предохранитель и батарейка.' },
        { id: 'box', x: 800, kind: 'door', label: 'Щиток', exit: true,
          needs: [{ item: 'fuse' }, { item: 'battery' }],
          lockedMsg: 'Нет питания. Не хватает деталей.', exitMsg: 'Щиток загудел, дорога открыта!' },
      ],
      solve: ['fuse', 'battery', 'box'],
    },
    {
      id: 4, title: 'Колючий куст', mech: 'items', palette: 'dusk',
      intro: 'Тропинка перегорожена кустом. За ним что-то блестит.',
      hint: 'Колючки срежет нож. А за кустом — фонарь, без него ворота не пройти.',
      hotspots: [
        { id: 'knife', x: 110, kind: 'pickup', item: 'knife', label: 'Нож' },
        { id: 'bush', x: 300, kind: 'door', label: 'Куст', needs: [{ item: 'knife' }],
          lockedMsg: 'Колючки. Нужен нож.', openMsg: 'Ветки срезаны.' },
        { id: 'lantern', x: 480, kind: 'pickup', item: 'lantern', label: 'Фонарь',
          visibleIf: [{ is: ['bush', 'open'] }] },
        { id: 'gate', x: 820, kind: 'door', label: 'Ворота', exit: true, needs: [{ item: 'lantern' }],
          lockedMsg: 'Слишком темно, чтобы идти дальше.', exitMsg: 'С фонарём дорога видна далеко.' },
      ],
      solve: ['knife', 'bush', 'lantern', 'gate'],
    },
    {
      id: 5, title: 'Колодец', mech: 'items', palette: 'dusk',
      intro: 'Колодец глубокий. Ведро на цепи где-то внизу.',
      hint: 'Бадья поднимается, когда на Мишутке верёвка и крюк.',
      hotspots: [
        { id: 'rope', x: 110, kind: 'pickup', item: 'rope', label: 'Верёвка' },
        { id: 'hook', x: 260, kind: 'pickup', item: 'hook', label: 'Крюк' },
        { id: 'well', x: 520, kind: 'door', label: 'Колодец', needs: [{ item: 'rope' }, { item: 'hook' }],
          lockedMsg: 'Нечем поднять бадью.', openMsg: 'Бадья поднята! Внутри ключ.' },
        { id: 'key', x: 600, kind: 'pickup', item: 'key', label: 'Ключ', visibleIf: [{ is: ['well', 'open'] }] },
        { id: 'gate', x: 840, kind: 'door', label: 'Ворота', exit: true, needs: [{ item: 'key' }],
          lockedMsg: 'Ворота заперты.', exitMsg: 'Ворота открыты, лес позади.' },
      ],
      solve: ['rope', 'hook', 'well', 'key', 'gate'],
    },

    // ---------- 2. Связанные выключатели ----------
    {
      id: 6, title: 'Гирлянда', mech: 'lights', palette: 'night',
      intro: 'Гирлянда на крыльце. Каждый рубильник тянет за собой соседа.',
      hint: 'Рубильник переключает и себя, и соседей. Ищите порядок по одному огоньку.',
      hotspots: [
        { id: 'sw1', x: 180, kind: 'switch', label: 'Рубильник 1', links: ['sw2'], init: 0 },
        { id: 'sw2', x: 380, kind: 'switch', label: 'Рубильник 2', links: ['sw1', 'sw3'], init: 1 },
        { id: 'sw3', x: 580, kind: 'switch', label: 'Рубильник 3', links: ['sw2'], init: 0 },
        { id: 'door', x: 820, kind: 'door', label: 'Крыльцо', exit: true,
          needs: [{ is: ['sw1', 1] }, { is: ['sw2', 1] }, { is: ['sw3', 1] }],
          lockedMsg: 'Гирлянда горит не вся.', exitMsg: 'Вся гирлянда горит! Дверь открылась.' },
      ],
      solve: ['sw1', 'sw3', 'door'],
    },
    {
      id: 7, title: 'Кольцо огней', mech: 'lights', palette: 'night',
      intro: 'Четыре огня по кругу. Нужны только левый и правый.',
      hint: 'Соседи по кругу — это первый и последний огонь. Попробуйте второй.',
      hotspots: [
        { id: 'a', x: 170, kind: 'switch', label: 'Огонь A', links: ['b', 'd'] },
        { id: 'b', x: 340, kind: 'switch', label: 'Огонь B', links: ['a', 'c'] },
        { id: 'c', x: 510, kind: 'switch', label: 'Огонь C', links: ['b', 'd'] },
        { id: 'd', x: 680, kind: 'switch', label: 'Огонь D', links: ['c', 'a'] },
        { id: 'gate', x: 860, kind: 'door', label: 'Ворота', exit: true,
          needs: [{ is: ['a', 1] }, { is: ['c', 1] }],
          lockedMsg: 'Огни A и C должны гореть.', exitMsg: 'Огни A и C горят. Ворота открыты.' },
      ],
      solve: ['b', 'gate'],
    },
    {
      id: 8, title: 'Ночной пульт', mech: 'lights', palette: 'night',
      intro: 'Пульт управления. Нужно погасить лишнее.',
      hint: 'Гасим ненужный свет: чтобы не мигала красная лампа, сначала погасите её соседей.',
      hotspots: [
        { id: 'p1', x: 150, kind: 'switch', label: 'Панель 1', links: ['p2'] },
        { id: 'p2', x: 320, kind: 'switch', label: 'Панель 2', links: ['p1', 'p3'] },
        { id: 'p3', x: 490, kind: 'switch', label: 'Панель 3', links: ['p2', 'p4'] },
        { id: 'p4', x: 660, kind: 'switch', label: 'Панель 4', links: ['p3'] },
        { id: 'gate', x: 860, kind: 'door', label: 'Люк', exit: true,
          needs: [{ is: ['p1', 1] }, { is: ['p4', 1] }, { isNot: ['p2', 1] }],
          lockedMsg: 'Не то сочетание огней.', exitMsg: 'Люк открыт.' },
      ],
      solve: ['p1', 'p3', 'gate'],
    },
    {
      id: 9, title: 'Тайный свет', mech: 'lights', palette: 'night',
      intro: 'За пультом спрятан ключ. Его видно, только когда горит свет.',
      hint: 'Ключ появится, когда загорится центральный огонь. Остальное — по соседям.',
      hotspots: [
        { id: 'l1', x: 170, kind: 'switch', label: 'Огонь 1', links: ['l2'] },
        { id: 'l2', x: 340, kind: 'switch', label: 'Огонь 2', links: ['l1', 'l3'] },
        { id: 'l3', x: 510, kind: 'switch', label: 'Огонь 3', links: ['l2'] },
        { id: 'key', x: 620, kind: 'pickup', item: 'key', label: 'Ключ', visibleIf: [{ is: ['l2', 1] }] },
        { id: 'gate', x: 860, kind: 'door', label: 'Ворота', exit: true, needs: [{ item: 'key' }, { is: ['l1', 1] }],
          lockedMsg: 'Нужен ключ и горящий первый огонь.', exitMsg: 'Ворота открыты!' },
      ],
      solve: ['l1', 'key', 'gate'],
    },
    {
      id: 10, title: 'Пять огоньков', mech: 'lights', palette: 'night',
      intro: 'Пять огоньков в ряд. Все должны гореть.',
      hint: 'Начните с крайних огоньков: они переключают только соседей.',
      hotspots: [
        { id: 'e1', x: 130, kind: 'switch', label: '1', links: ['e2'] },
        { id: 'e2', x: 270, kind: 'switch', label: '2', links: ['e1', 'e3'] },
        { id: 'e3', x: 410, kind: 'switch', label: '3', links: ['e2', 'e4'] },
        { id: 'e4', x: 550, kind: 'switch', label: '4', links: ['e3', 'e5'] },
        { id: 'e5', x: 690, kind: 'switch', label: '5', links: ['e4'] },
        { id: 'gate', x: 860, kind: 'door', label: 'Ворота', exit: true,
          needs: [{ is: ['e1', 1] }, { is: ['e2', 1] }, { is: ['e3', 1] }, { is: ['e4', 1] }, { is: ['e5', 1] }],
          lockedMsg: 'Не все огоньки горят.', exitMsg: 'Все огни горят!' },
      ],
      solve: ['e1', 'e4', 'gate'],
    },

    // ---------- 3. Рычаги по порядку ----------
    {
      id: 11, title: 'Механизм у реки', mech: 'levers', palette: 'river',
      intro: 'Механизм запускается, если тянуть рычаги в нужном порядке.',
      hint: 'Табличка на стене называет порядок символами. Читайте её слева направо.',
      sequence: ['moon', 'sun', 'star'],
      hotspots: [
        { id: 'moon', x: 200, kind: 'lever', label: '☾ Луна' },
        { id: 'sun', x: 360, kind: 'lever', label: '☀ Солнце' },
        { id: 'star', x: 520, kind: 'lever', label: '★ Звезда' },
        { id: 'board', x: 700, kind: 'clue', label: 'Табличка', text: 'Сначала ночь, потом день, потом звёзды.' },
        { id: 'gate', x: 860, kind: 'door', label: 'Шлюз', exit: true, needs: [{ flag: 'seqDone' }],
          lockedMsg: 'Механизм молчит.', exitMsg: 'Шлюз открыт. Река свободна!' },
      ],
      solve: ['moon', 'sun', 'star', 'gate'],
    },
    {
      id: 12, title: 'Четыре рычага', mech: 'levers', palette: 'river',
      intro: 'Рычагов четыре, порядок — три. Один лишний.',
      hint: 'Облако в порядке не участвует. Не трогайте его.',
      sequence: ['sun', 'star', 'moon'],
      hotspots: [
        { id: 'sun', x: 170, kind: 'lever', label: '☀ Солнце' },
        { id: 'cloud', x: 330, kind: 'lever', label: '☁ Облако' },
        { id: 'star', x: 490, kind: 'lever', label: '★ Звезда' },
        { id: 'moon', x: 650, kind: 'lever', label: '☾ Луна' },
        { id: 'board', x: 700, kind: 'clue', label: 'Записка', text: 'Солнце — звезда — луна. Облака не нужны.', visibleIf: [] },
        { id: 'gate', x: 860, kind: 'door', label: 'Шлюз', exit: true, needs: [{ flag: 'seqDone' }],
          lockedMsg: 'Механизм молчит.', exitMsg: 'Шлюз открыт.' },
      ],
      solve: ['sun', 'star', 'moon', 'gate'],
    },
    {
      id: 13, title: 'Шлюз', mech: 'levers', palette: 'river',
      intro: 'Вода поднимается. Шлюз нужно открыть быстро.',
      hint: 'Сначала запустите насос, потом шлюз. Обратите внимание на надписи.',
      sequence: ['pump', 'valve', 'wheel'],
      hotspots: [
        { id: 'valve', x: 260, kind: 'lever', label: 'Клапан' },
        { id: 'pump', x: 120, kind: 'lever', label: 'Насос' },
        { id: 'wheel', x: 420, kind: 'lever', label: 'Колесо' },
        { id: 'board', x: 580, kind: 'clue', label: 'Схема', text: 'Насос подаёт воду, клапан её держит, колесо открывает шлюз.' },
        { id: 'gate', x: 860, kind: 'door', label: 'Шлюз', exit: true, needs: [{ flag: 'seqDone' }],
          lockedMsg: 'Вода ещё стоит.', exitMsg: 'Вода ушла. Мост виден!' },
      ],
      solve: ['pump', 'valve', 'wheel', 'gate'],
    },
    {
      id: 14, title: 'Рычаги и ключ', mech: 'levers', palette: 'river',
      intro: 'Шлюз заперт, и рычаги ещё нужны. Сначала нужен ключ от ящика.',
      hint: 'Сначала запустите рычаги по порядку. Тогда откроется ящик с ключом.',
      sequence: ['star', 'moon'],
      hotspots: [
        { id: 'star', x: 180, kind: 'lever', label: '★ Звезда' },
        { id: 'moon', x: 340, kind: 'lever', label: '☾ Луна' },
        { id: 'box', x: 500, kind: 'door', label: 'Ящик', needs: [{ flag: 'seqDone' }],
          lockedMsg: 'Ящик не открывается.', openMsg: 'Ящик открыт. Внутри ключ.' },
        { id: 'key', x: 560, kind: 'pickup', item: 'key', label: 'Ключ', visibleIf: [{ is: ['box', 'open'] }] },
        { id: 'gate', x: 860, kind: 'door', label: 'Шлюз', exit: true, needs: [{ item: 'key' }],
          lockedMsg: 'Шлюз заперт.', exitMsg: 'Шлюз открыт!' },
      ],
      solve: ['star', 'moon', 'box', 'key', 'gate'],
    },
    {
      id: 15, title: 'Мост из звёзд', mech: 'levers', palette: 'river',
      intro: 'Пять рычагов над водой. Мост собирается по созвездию.',
      hint: 'Порядок — как созвездие на табличке: от луны до последней звезды.',
      sequence: ['moon', 'star', 'sun', 'cloud', 'star2'],
      hotspots: [
        { id: 'moon', x: 110, kind: 'lever', label: '☾ Луна' },
        { id: 'star', x: 250, kind: 'lever', label: '★ Звезда' },
        { id: 'sun', x: 390, kind: 'lever', label: '☀ Солнце' },
        { id: 'cloud', x: 530, kind: 'lever', label: '☁ Облако' },
        { id: 'star2', x: 670, kind: 'lever', label: '✦ Звезда-2' },
        { id: 'board', x: 800, kind: 'clue', label: 'Созвездие', text: 'Луна, звезда, солнце, облако и последняя звезда.' },
        { id: 'gate', x: 860, kind: 'door', label: 'Мост', exit: true, needs: [{ flag: 'seqDone' }],
          lockedMsg: 'Мост не собран.', exitMsg: 'Мост собран! Переход открыт.' },
      ],
      solve: ['moon', 'star', 'sun', 'cloud', 'star2', 'gate'],
    },

    // ---------- 4. Код ----------
    {
      id: 16, title: 'Календарь', mech: 'code', palette: 'forest',
      intro: 'Дверь с цифровой панелью. Код подсказан на календаре.',
      hint: 'Календарь показывает число и месяц. Код — из них.',
      hotspots: [
        { id: 'calendar', x: 260, kind: 'clue', label: 'Календарь', text: 'Четвёртое число, седьмой месяц.' },
        { id: 'keypad', x: 720, kind: 'keypad', label: 'Панель', code: '47', exit: true,
          askMsg: 'Введите код.', exitMsg: 'Дверь щёлкнула и открылась!' },
      ],
      solve: [{ id: 'keypad', code: '47' }],
    },
    {
      id: 17, title: 'Часы на башне', mech: 'code', palette: 'forest',
      intro: 'Часы остановились. Панель ждёт нужного времени.',
      hint: 'Часовая стрелка и минутная стрелка дают код.',
      hotspots: [
        { id: 'clock', x: 240, kind: 'clue', label: 'Часы', text: 'Часы показывают три часа и пятнадцать минут.' },
        { id: 'keypad', x: 700, kind: 'keypad', label: 'Панель', code: '315', exit: true,
          askMsg: 'Введите время с часов.', exitMsg: 'Башня ожила. Дверь открыта!' },
      ],
      solve: [{ id: 'keypad', code: '315' }],
    },
    {
      id: 18, title: 'Сейф у ручья', mech: 'code', palette: 'forest',
      intro: 'Сейф. На его крышке три камня, у каждого своя цифра.',
      hint: 'Каждый камень — одна цифра. Они лежат у сейфа: посмотрите на них.',
      hotspots: [
        { id: 'stone1', x: 130, kind: 'clue', label: 'Камень с одной риской', text: 'Камень: одна черта. Цифра 1.' },
        { id: 'stone2', x: 280, kind: 'clue', label: 'Камень с двумя точками', text: 'Камень: две точки. Цифра 2.' },
        { id: 'stone3', x: 430, kind: 'clue', label: 'Камень с тремя кругами', text: 'Камень: три круга. Цифра 3.' },
        { id: 'keypad', x: 720, kind: 'keypad', label: 'Сейф', code: '123', exit: true,
          askMsg: 'Введите число с камней.', exitMsg: 'Сейф открыт. Внутри тёплый мёд!' },
      ],
      solve: [{ id: 'keypad', code: '123' }],
    },
    {
      id: 19, title: 'Двойной код', mech: 'code', palette: 'forest',
      intro: 'Панель открывает только первая часть кода. Нужна вторая.',
      hint: 'Вторая часть — это лампа с цифрой. Лампа под ключом.',
      hotspots: [
        { id: 'note', x: 180, kind: 'clue', label: 'Записка', text: 'Код состоит из двух частей: первая — 5, вторая — лампа.' },
        { id: 'lamp', x: 380, kind: 'switch', label: 'Лампа', values: ['0', '1', '2', '3'], msg: 'Лампа показывает цифру.' },
        { id: 'keypad', x: 720, kind: 'keypad', label: 'Панель', code: '52', exit: true,
          needs: [{ is: ['lamp', 2] }], lockedMsg: 'Панель тёмная. Лампа не на нужной цифре.',
          askMsg: 'Введите 2 цифры.', exitMsg: 'Панель щёлкнула, дверь открыта!' },
      ],
      solve: ['lamp', 'lamp', { id: 'keypad', code: '52' }],
    },

    // ---------- 5. Лампа и тень ----------
    {
      id: 20, title: 'Тень на стене', mech: 'lamp', palette: 'cave',
      intro: 'Лампа бросает тень. Тень должна стать нужной формой.',
      hint: 'Лампа поворачивается, и от её угла зависит тень. Ищите двойку.',
      hotspots: [
        { id: 'lamp', x: 180, kind: 'switch', label: 'Лампа', values: ['0', '1', '2', '3'],
          msg: 'Тень сдвинулась.' },
        { id: 'shadow', x: 620, kind: 'door', label: 'Тень-проход', exit: true, needs: [{ is: ['lamp', 2] }],
          lockedMsg: 'Тень не совпадает с проходом.', exitMsg: 'Тень сложилась в мост. Пройдём по ней!' },
      ],
      solve: ['lamp', 'lamp', 'shadow'],
    },
    {
      id: 21, title: 'Две лампы', mech: 'lamp', palette: 'cave',
      intro: 'Две лампы дают две тени. Они должны совпасть.',
      hint: 'Первая лампа — на единицу, вторая — на тройку. Проверьте по очереди.',
      hotspots: [
        { id: 'lampA', x: 150, kind: 'switch', label: 'Лампа A', values: ['0', '1', '2', '3'], msg: 'Тень A сдвинулась.' },
        { id: 'lampB', x: 330, kind: 'switch', label: 'Лампа B', values: ['0', '1', '2', '3'], msg: 'Тень B сдвинулась.' },
        { id: 'shadow', x: 720, kind: 'door', label: 'Тень-проход', exit: true,
          needs: [{ is: ['lampA', 1] }, { is: ['lampB', 3] }],
          lockedMsg: 'Тени не совпадают.', exitMsg: 'Тени совпали! Проход открыт.' },
      ],
      solve: ['lampA', 'lampB', 'lampB', 'lampB', 'shadow'],
    },
    {
      id: 22, title: 'Рисунок из тени', mech: 'lamp', palette: 'cave',
      intro: 'На стене проявляется рисунок, если тень сложилась правильно.',
      hint: 'Ключ появится на стене при правильном свете. Лампа на двойке.',
      hotspots: [
        { id: 'lamp', x: 160, kind: 'switch', label: 'Лампа', values: ['0', '1', '2', '3'], msg: 'Свет меняется.' },
        { id: 'key', x: 480, kind: 'pickup', item: 'key', label: 'Ключ', visibleIf: [{ is: ['lamp', 2] }] },
        { id: 'gate', x: 840, kind: 'door', label: 'Дверь', exit: true, needs: [{ item: 'key' }],
          lockedMsg: 'Дверь заперта.', exitMsg: 'Дверь открыта. Пещера позади.' },
      ],
      solve: ['lamp', 'lamp', 'key', 'gate'],
    },

    // ---------- 6. Смешанные ----------
    {
      id: 23, title: 'Тайник', mech: 'mixed', palette: 'ruins',
      intro: 'В стене тайник. Рубильник откроет карту, а карта — путь.',
      hint: 'Карта появится, когда рубильник включён. Потом — рычаги по карте.',
      sequence: ['moon', 'star'],
      hotspots: [
        { id: 'panel', x: 150, kind: 'switch', label: 'Рубильник', links: [] },
        { id: 'map', x: 360, kind: 'pickup', item: 'map', label: 'Карта', visibleIf: [{ is: ['panel', 1] }],
          msg: 'Карта: ночь, потом звезда.' },
        { id: 'moon', x: 540, kind: 'lever', label: '☾ Луна' },
        { id: 'star', x: 640, kind: 'lever', label: '★ Звезда' },
        { id: 'gate', x: 860, kind: 'door', label: 'Ворота', exit: true, needs: [{ flag: 'seqDone' }, { item: 'map' }],
          lockedMsg: 'Нужна карта и механизм.', exitMsg: 'Ворота открыты по карте!' },
      ],
      solve: ['panel', 'map', 'moon', 'star', 'gate'],
    },
    {
      id: 24, title: 'Шифр на плакате', mech: 'mixed', palette: 'ruins',
      intro: 'Плакат виден только при свете. Код записан на нём.',
      hint: 'Лампа на тройке высвечивает надпись на плакате.',
      hotspots: [
        { id: 'lamp', x: 150, kind: 'switch', label: 'Лампа', values: ['0', '1', '2', '3'] },
        { id: 'poster', x: 430, kind: 'clue', label: 'Плакат', text: 'Код: 9 · 2 · 7.',
          visibleIf: [{ is: ['lamp', 3] }] },
        { id: 'poster-hint', x: 430, kind: 'clue', label: 'Плакат', text: 'Лампа должна светить ярче. Подсветите плакат.',
          visibleIf: [{ isNot: ['lamp', 3] }] },
        { id: 'keypad', x: 780, kind: 'keypad', label: 'Панель', code: '927', exit: true,
          askMsg: 'Введите код с плаката.', exitMsg: 'Панель открыта. Выход найден!' },
      ],
      solve: ['lamp', 'lamp', 'lamp', 'poster', { id: 'keypad', code: '927' }],
    },
    {
      id: 25, title: 'Дорога домой', mech: 'mixed', palette: 'dawn',
      intro: 'Последний уровень первой части. Все механизмы сходятся.',
      hint: 'Ключ — из колодца, рычаги — по табличке, лампа — на единице. Всё по очереди.',
      sequence: ['moon', 'sun'],
      hotspots: [
        { id: 'rope', x: 110, kind: 'pickup', item: 'rope', label: 'Верёвка' },
        { id: 'well', x: 280, kind: 'door', label: 'Колодец', needs: [{ item: 'rope' }],
          lockedMsg: 'Нечем поднять бадью.', openMsg: 'Бадья поднята. Внутри ключ.' },
        { id: 'key', x: 340, kind: 'pickup', item: 'key', label: 'Ключ', visibleIf: [{ is: ['well', 'open'] }] },
        { id: 'lamp', x: 480, kind: 'switch', label: 'Лампа', values: ['0', '1', '2', '3'], msg: 'Свет на стене.' },
        { id: 'moon', x: 600, kind: 'lever', label: '☾ Луна' },
        { id: 'sun', x: 680, kind: 'lever', label: '☀ Солнце' },
        { id: 'home', x: 860, kind: 'door', label: 'Дом', exit: true,
          needs: [{ item: 'key' }, { flag: 'seqDone' }, { is: ['lamp', 1] }],
          lockedMsg: 'Дом заперт: не хватает ключа, механизма или света.',
          exitMsg: 'Мишутка дома. Первая часть пройдена!' },
      ],
      solve: ['rope', 'well', 'key', 'lamp', 'moon', 'sun', 'home'],
    },
  ];

  root.QLEVELS = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof self !== 'undefined' ? self : globalThis);
