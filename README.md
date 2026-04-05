# Cypher Novel Translator 

![Cypher Translator Banner](https://img.shields.io/badge/Status-Active-success)
![NodeJS](https://img.shields.io/badge/Node.js-18%2B-green.svg)
![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow.svg)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-blue.svg)
![Groq](https://img.shields.io/badge/Powered%20by-Groq-orange)

Una potente aplicación web de traducción de novelas ligeras (Light Novels) y textos largos impulsada por la **API de Groq**. 

Construida para ofrecer traducciones rápidas, precisas y coherentes mediante el uso de potentes modelos de lenguaje (LLM) y un sistema estricto de glosarios por proyecto.

---

##  Características Principales

*   **Traducciones Ultrarrápidas:** Integración directa con la API de Groq para aprovechar velocidades de inferencia extremas.
*   **Sistema de Glosarios Estricto:** Mantén la coherencia en nombres, términos y lugares en todos los capítulos. ¡El LLM está instruido para respetar tu glosario por encima de todo!
*   **Seguimiento de Consumo de Tokens:** Monitor en tiempo real de los tokens consumidos por modelo directamente desde la interfaz, almacenado localmente en tu navegador (LocalStorage).
*   **Gestión de Proyectos/Novelas:** Organiza tus traducciones por "Novelas". Cada novela guarda su propio historial de capítulos, glosarios y progreso de forma estructurada.
*   **Exportación Multiformato:** Exporta tus traducciones y resultados unificados al instante (Soporte nativo a `.txt`).
*   **Interfaz Moderna y Responsiva:** Diseño limpio, modo oscuro y rápido construido con Vanilla JS y Tailwind CSS, sin frameworks pesados ni carga inútil.
*   **Modelos de IA Optimizados:** Configurada para funcionar a la perfección con:
    *   `llama-3.3-70b-versatile` (Recomendado para la mejor calidad y narrativa)
    *   `llama-3.1-8b-instant` (Para traducciones ultrarrápidas y de bajo costo)
    *   `meta-llama/llama-4-scout-17b-16e-instruct` 
    *   `qwen/qwen3-32b` (Con soporte automático de backend para remover etiquetas `</s>` de los modelos racionales)

---

## 🛠️ Requisitos Previos

*   **Node.js** v18.0.0 o superior.
*   Una cuenta activa y una **API Key de Groq**. [Consíguela gratis aquí](https://console.groq.com/).

---

## 🚀 Instalación y Despliegue Local

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/cypher-novel-translator.git
    cd cypher-novel-translator
    ```

2.  **Instalar dependencias del servidor:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Renombra o crea un archivo `.env` en la raíz del proyecto y añade las configuraciones base:
    ```env
    GROQ_API_KEY=gsk_tu_clave_de_api_aqui
    PORT=3000
    ```

4.  **Iniciar la Aplicación:**
    ```bash
    npm start
    # O si prefieres monitoreo en desarrollo:
    npm run dev
    ```

5.  **Abrir el Cliente:**
    Por defecto, abre tu navegador favorito en `http://localhost:3000` y empieza a traducir.

---

## 📝 Guía de Uso

1.  **Crear un Proyecto:** Abre el panel lateral y añade una "Nueva Novela" con el nombre deseado.
2.  **Alimentar el Glosario:** Selecciona la novela. Añade todos los nombres propios, honoríficos y terminología específica que debe respetarse durante todo el proyecto (ej: `Onii-chan` -> `Hermano`).
3.  **Ejecutar Traducción:** Pega el bloque de texto crudo de la novela (japonés, coreano, chino o inglés) en la caja de la izquierda y presiona "Traducir", el backend conectará con Groq usando un prompt duro que fuerza al modelo a atenerse al glosario.
4.  **Control de Consumo:** Accede a la pestaña superior "Consumo" para ver gráficamente e interactivamente el gasto de tokens por consulta y modelo a nivel local.

---

## 🤝 Contribuciones y Soporte

Las sugerencias, mejoras de UI y Pull Requests son completamente bienvenidas, si quieres proponer prompts más robustos o soporte universal a EPUB/PDF, abre un Issue o inicia un fork para el proyecto.

---

## 📄 Licencia

Este proyecto está liberado bajo la Licencia **MIT**. Consulta el archivo `LICENSE` en la raíz del repositorio para más información.

---
*Diseñado con ❤️ para la comunidad global de traductores de Novelas Ligeras, simplificando horas de edición manual en nombres y contextos.*
