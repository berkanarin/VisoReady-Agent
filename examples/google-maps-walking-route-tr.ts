import { resolve, join } from 'node:path';
import { mkdir, copyFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { capture } from '../src/capture.js';
import { compile, build } from '../src/project.js';
import { checkEditor } from '../src/editor.js';
import { resolveEditor } from '../src/runtime.js';
import { newDirectory, writeJson } from '../src/files.js';

const out = await newDirectory(resolve(process.argv[2] || 'output/google-maps-walking-route-tr'));
const button = (name: string) => ({ role: 'button' as const, name });
const textbox = (name: string) => ({ role: 'textbox' as const, name });
const reverse = button('Başlangıç noktası ile hedefin yerini değiştir');
const destination = textbox('Varış noktası seçin veya haritayı tıklayın...');
const walking = { role: 'radio' as const, name: 'Yürüyüş' };
const copy = {
  start: { label: 'Kolezyum’dan başlayın', text: 'Kolezyum için Yol tarifi ekranını açtık. Burayı başlangıç noktası yapmak için yer değiştirme düğmesine tıklayın.' },
  walking: { label: 'Yürüyerek keşfedin', text: 'Roma’nın merkezinde yürüyüş rotası oluşturmak için Yürüyüş seçeneğini işaretleyin.' },
  pantheon: { label: 'İlk durak: Panteon', text: 'Varış alanına Pantheon, Rome yazın ve yeri seçin. İşaretli alana tıklayarak sonucu görebilirsiniz.' },
  'add-stop': { label: 'Bir durak daha ekleyin', text: 'İlk bölüm hazır. Aynı rotaya üçüncü bir yer eklemek için Hedef ekleyin düğmesine tıklayın.' },
  trevi: { label: 'Trevi Çeşmesi’ni ekleyin', text: 'Yeni varış alanına Trevi Fountain, Rome yazın ve yeri seçin. İşaretli alana tıklayarak sonucu görebilirsiniz.' },
  review: { label: 'Rotanızı inceleyin', text: 'Rota, Kolezyum’u, Panteon’u ve Trevi Çeşmesi’ni birleştiriyor. Yürüyüş adımlarını görmek için Ayrıntılar düğmesine tıklayın.' },
  details: { label: 'Rotanız hazır', text: 'Google Haritalar’da rotayı paylaşmak için Yol tarifini paylaşın düğmesini kullanabilirsiniz. Yola çıkmadan önce güncel rotayı kontrol edin; bu demo canlı navigasyon değildir.' }
};
const annotation = (target: unknown, key: keyof typeof copy, next?: string) => ({
  target, ...copy[key], trigger: next ? 'goto' : 'auto', ...(next ? { goto: next } : {}),
  style: 'frame', spot: 'square', backdrop: false, showLabel: true
});
const recipe = {
  version: 1, title: 'Google Haritalar’da üç duraklı yürüyüş rotası oluşturun', language: 'tr',
  fidelity: 'actual-source', startUrl: 'https://www.google.com/maps/search/Colosseum,+Rome/?hl=tr&gl=tr',
  allowedOrigins: ['https://www.google.com'], viewport: { width: 1440, height: 900 },
  steps: [
    { key: 'start', title: 'Kolezyum’u başlangıç yapın', actions: [{ type: 'click', target: button('Yol tarifi') }], ready: reverse, annotations: [annotation(reverse, 'start', 'walking')] },
    { key: 'walking', title: 'Yürüyüş yol tarifini seçin', actions: [{ type: 'click', target: reverse }], ready: walking, annotations: [annotation(walking, 'walking', 'pantheon')] },
    { key: 'pantheon', title: 'İlk varış noktasını belirleyin', actions: [{ type: 'click', target: walking }], ready: destination, annotations: [annotation(destination, 'pantheon', 'add-stop')] },
    { key: 'add-stop', title: 'Yeni bir durak ekleyin', actions: [{ type: 'fill', target: destination, value: 'Pantheon, Rome' }, { type: 'press', target: textbox('Hedef Pantheon, Rome'), key: 'Enter' }],
      ready: button('Hedef ekleyin'), assertions: [{ target: '[role="main"][aria-label="Yol tarifi"]', containsText: 'Ayrıntılar' }], annotations: [annotation(button('Hedef ekleyin'), 'add-stop', 'trevi')] },
    { key: 'trevi', title: 'Trevi Çeşmesi’ni rotaya ekleyin', actions: [{ type: 'click', target: button('Hedef ekleyin') }], ready: destination, annotations: [annotation(destination, 'trevi', 'review')] },
    { key: 'review', title: 'Üç duraklı rotayı inceleyin', actions: [{ type: 'fill', target: destination, value: 'Trevi Fountain, Rome' }, { type: 'press', target: textbox('Hedef Trevi Fountain, Rome'), key: 'Enter' }],
      ready: button('Hedef ekleyin'), assertions: [{ target: '[role="main"][aria-label="Yol tarifi"]', containsText: 'Ayrıntılar' }], annotations: [annotation(button('Ayrıntılar'), 'review', 'details')] },
    { key: 'details', title: 'Yola çıkmadan önce kontrol edin', actions: [{ type: 'click', target: button('Ayrıntılar') }], ready: button('Yol tarifini paylaşın'), annotations: [annotation(button('Yol tarifini paylaşın'), 'details')] }
  ].map(step => ({ ...step, settleMs: 3500 }))
};
await writeJson(join(out, 'recipe.json'), recipe);
// Keep signed-out consent state private and separate from redistributable files.
const auth = join(out, '.auth');
await mkdir(auth);
const state = join(auth, 'consent.json');
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ locale: 'tr-TR', viewport: recipe.viewport });
  const page = await context.newPage();
  await page.goto(recipe.startUrl, { waitUntil: 'domcontentloaded' });
  const reject = page.getByRole('button', { name: 'Tümünü reddet', exact: true });
  if (await reject.isVisible()) await reject.click();
  await page.getByRole('button', { name: 'Yol tarifi', exact: true }).waitFor({ state: 'visible' });
  await context.storageState({ path: state });
} finally { await browser.close(); }
console.log('Gerçek Türkçe Google Haritalar ekranları yakalanıyor.');
const manifest = await capture(recipe, join(out, 'captures'), { allowActions: true, storageState: state });
const validated = await compile(manifest);
if (validated.project.steps.length !== 7) throw new Error('Expected seven screens');
await build(manifest, join(out, 'flow'));
const project = validated.project;
project.meta.introDescription = 'Roma’yı yürüyerek keşfedin: Kolezyum, Panteon ve Trevi Çeşmesi. Gerçek Türkçe Google Haritalar arayüzünden yakalanan etkileşimli kılavuz. Hesap gerekmez.';
await writeJson(join(out, 'project.ohig.json'), project);
await writeJson(join(out, 'build-warnings.json'), validated.warnings);
console.log('Proje ve çevrimdışı oynatıcı masaüstü/mobil boyutlarda kontrol ediliyor.');
await checkEditor(join(out, 'project.ohig.json'), await resolveEditor(), join(out, 'verified'));
await copyFile(join(out, 'verified/preview.html'), join(out, 'index.html'));
console.log(out);
