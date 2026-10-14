# 🍉 Suika 3D — Fruit Merge Game (Android Nativo)

Jogo das Frutas (Suika Game) em **3D Moderno / 2.5D** com física de corpos rígidos, renderização WebGL via Three.js, expressões faciais Kawaii, síntese de áudio procedural e empacotamento em APK nativo para Android.

## 🎮 Mecânica do Jogo

- **Solte Frutas**: Arraste o dedo no topo da caixa de acrílico para mirar e soltar.
- **Fusão de Pares**: Quando duas frutas iguais colidem, elas se fundem na fruta do próximo nível!
- **Árvore de Evolução**:
  🍒 Cereja → 🍓 Morango → 🍇 Uva → 🍊 Tangerina → 🍋 Laranja → 🍎 Maçã → 🍐 Pera → 🍑 Pêssego → 🍍 Abacaxi → 🍈 Melão → 🍉 **Melancia!**
- **Efeitos de Suco**: Explosão de partículas de suco e som de pop em cada fusão.
- **Linha de Perigo**: Não deixe as frutas empilharem acima da linha vermelha por mais de 3 segundos!

## 📱 Tecnologias

- **Motor 3D**: Three.js WebGL com iluminação de estúdio e materiais translúcidos
- **Física 2.5D**: Detecção de colisão círculo-círculo, impulso elástico, atrito e gravidade
- **Áudio**: Web Audio API com sintetizador procedural (sem arquivos de áudio externos, 100% offline)
- **Haptics**: Vibração nativa via AndroidBridge / `navigator.vibrate`
- **Android**: WebView acelerada por hardware em modo imersivo fullscreen (Kotlin)
- **CI/CD**: Build automatizado do APK via **GitHub Actions**

## 🚀 Como Compilar o APK

O repositório possui compilação automatizada via GitHub Actions (`.github/workflows/build-apk.yml`).
A cada push na branch `main`, o APK de debug é gerado e disponibilizado para download.
