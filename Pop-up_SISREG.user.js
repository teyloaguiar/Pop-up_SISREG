// ==UserScript==
// @name         Pop-up SISREG
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Pop-up com resumo da solicitação do SISREG e envio por WhatsApp
// @author       Teylo Laundos Aguiar
// @match        https://sisregiii.saude.gov.br/*
// @updateURL    https://github.com/teyloaguiar/Pop-up_SISREG/raw/refs/heads/main/Pop-up_SISREG.user.js
// @downloadURL  https://github.com/teyloaguiar/Pop-up_SISREG/raw/refs/heads/main/Pop-up_SISREG.user.js
// @grant        GM_openInTab
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// ==/UserScript==

(function() {
    'use strict';

    let currentPopup = null;
    let currentButton = null;
    let whatsapp = null;

    // Carrega o jsPDF corretamente
    const { jsPDF } = window.jspdf;

    // Adiciona estilos CSS diretamente
    GM_addStyle(`
        .sisreg-popup-button {
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            padding: 10px 15px !important;
            background-color: #2196F3 !important;
            color: white !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            z-index: 9998 !important;
            font-weight: bold !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
            font-size: 14px !important;
        }

        .sisreg-popup-button:hover {
            opacity: 0.9 !important;
        }

        .sisreg-popup-button.active {
            background-color: #f44336 !important;
        }

        .sisreg-popup-container {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background-color: white !important;
            padding: 20px !important;
            border: 1px solid #ccc !important;
            border-radius: 5px !important;
            box-shadow: 0 0 10px rgba(0,0,0,0.2) !important;
            z-index: 9999 !important;
            max-width: 80% !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
        }

        .sisreg-popup-container h3 {
            margin-top: 0 !important;
        }

        .sisreg-popup-table {
            width: 100% !important;
            border-collapse: collapse !important;
        }

        .sisreg-popup-table td {
            padding: 8px !important;
            border-bottom: 1px solid #eee !important;
            font-size: 14px !important;
        }

        .sisreg-popup-table td:first-child {
            font-weight: bold !important;
            vertical-align: top !important;
            white-space: nowrap !important;
        }

        .sisreg-popup-buttons-container {
            margin-top: 15px !important;
            display: flex !important;
            justify-content: space-between !important;
            flex-wrap: wrap !important;
            gap: 10px !important;
        }

        .sisreg-popup-button-action {
            flex: 1 !important;
            min-width: 150px !important;
            padding: 8px 15px !important;
            color: white !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
        }

        .sisreg-whatsapp-input {
            padding: 8px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
            margin-bottom: 5px !important;
        }

        .sisreg-error-message {
            color: red !important;
            margin-top: 5px !important;
            display: none !important;
        }
    `);

    // Função para buscar Data e Horário à direita do resultado do Profissional Executante
    function findDateTime() {
        const tables = document.getElementsByTagName('table');

        for (let table of tables) {
            const rows = table.rows;

            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].cells;

                for (let j = 0; j < cells.length; j++) {
                    if (cells[j].textContent.trim() === "Profissional Executante:") {
                        const valueRow = rows[i+1];
                        if (valueRow) {
                            const valueCell = valueRow.cells[j];
                            if (valueCell) {
                                const dateTimeCell = valueRow.cells[j+1];
                                if (dateTimeCell) {
                                    return dateTimeCell.textContent.trim();
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    // Função para buscar Unidade Executante
    function findUnidadeExecutante() {
        const tables = document.getElementsByTagName('table');

        for (let table of tables) {
            const rows = table.rows;

            for (let i = 0; i < rows.length; i++) {
                if (rows[i].textContent.trim() === "UNIDADE EXECUTANTE") {
                    if (i + 2 < rows.length) {
                        const targetRow = rows[i + 2];
                        if (targetRow.cells.length > 0) {
                            return targetRow.cells[0].textContent.trim();
                        }
                    }
                }
            }
        }
        return null;
    }

    // Função para buscar Nome do Paciente (atualizada)
    function findNomePaciente() {
        const tables = document.getElementsByTagName('table');

        // Primeira tentativa: "DADOS DO PACIENTE"
        for (let table of tables) {
            const rows = table.rows;

            for (let i = 0; i < rows.length; i++) {
                if (rows[i].textContent.trim() === "DADOS DO PACIENTE") {
                    if (i + 2 < rows.length) {
                        const targetRow = rows[i + 2];
                        if (targetRow.cells.length > 1) {
                            return targetRow.cells[1].textContent.trim();
                        }
                    }
                }
            }
        }

        // Segunda tentativa: "Nome do Paciente" e célula abaixo
        for (let table of tables) {
            const rows = table.rows;

            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].cells;

                for (let j = 0; j < cells.length; j++) {
                    if (cells[j].textContent.trim() === "Nome do Paciente") {
                        const value = findValueBelowInSameColumn(cells[j]);
                        if (value) {
                            return value;
                        }
                    }
                }
            }
        }

        return null;
    }

    // Função para buscar Procedimentos
    function findProcedures() {
        const tables = document.getElementsByTagName('table');
        const possibleHeaders = ["Procedimentos Solicitados:", "Procedimentos Autorizados:"];

        for (let table of tables) {
            const tBodies = table.tBodies;

            for (let tbody of tBodies) {
                const rows = tbody.rows;
                let procedures = [];
                let foundHeader = false;

                for (let i = 0; i < rows.length; i++) {
                    const cells = rows[i].cells;

                    for (let j = 0; j < cells.length; j++) {
                        const cellText = cells[j].textContent.trim();
                        if (possibleHeaders.includes(cellText)) {
                            foundHeader = true;
                            continue;
                        }
                    }

                    if (foundHeader && cells.length > 0) {
                        const procedureText = cells[0].textContent.trim();
                        if (procedureText && !possibleHeaders.includes(procedureText)) {
                            procedures.push(procedureText);
                        }
                    }
                }

                if (procedures.length > 0) {
                    return procedures.join('\n');
                }
            }
        }
        return null;
    }

    // Função para validar o número de WhatsApp
    function validateWhatsApp(number) {
        const num = number.replace(/\D/g, '');
        if (num.length !== 11) return false;
        if (num[2] !== '9') return false;
        const numInt = parseInt(num);
        return numInt > 11910000000 && numInt < 99999999999;
    }

    // Função para formatar a mensagem do WhatsApp
    function formatWhatsAppMessage(data) {
        let message = "🧑‍⚕️ *Seu agendamento foi realizado!*\n\n ⚠️ *ATENÇÃO* ⚠️\n\n> *Digite 1️⃣ para* ✅ \`CONFIRMAR\`\n> _Irei ao atendimento._\n\n> *Digite 9️⃣ para* ❌ \`CANCELAR\`\n> _Não preciso mais desse atendimento._\n\n";

        message += `\`\`\`-----------------------\n SOLICITAÇÃO ${data["Código da Solicitação:"]  || 'Não informado'}\`\`\`\n\`\`\`-----------------------\`\`\`\n\n`;

        message += `🔑 \`CHAVE DE CONFIRMAÇÃO:\`\n └─ ${data["Chave de Confirmação:"] || 'Não informado'}\n\n`;

        message += `👤 \`NOME DO PACIENTE:\`\n └─ ${data["Nome do Paciente"] || 'Não informado'}\n\n`;
        message += `🩺 \`PROFISSIONAL EXECUTANTE:\`\n └─ ${data["Profissional Executante:"] || 'Não informado'}\n\n`;

        message += `🗓️ \`DATA E HORÁRIO:\`\n └─ ${data["Data e Horário de Atendimento:"] || 'Não informado'}\n\n`;

        message += `📌️ \`LOCAL DO ATENDIMENTO:\`\n └─ *${data["Unidade Executante:"] || 'Não informado'}* - `;

        const endereco = data["Endereço:"] || '';
        const numero = data["Número:"] || '';
        const bairro = data["Bairro:"] || '';
        const complemento = data["Complemento:"] || '';
        message += `${endereco}${numero ? ', ' + numero : ''}${bairro ? ' - ' + bairro : ''}${complemento ? ', ' + complemento : ''}`;

        message += `, ${data["Município:"] || 'Não informado'}\n\n`;
        message += `\`PROCEDIMENTO:\`\n- ${(data["Procedimentos Solicitados:"] || 'Não informado').replace(/\n/g, '\n- ')}`;

        return message;
    }

    // Função para atualizar o botão conforme o estado
    function updateButton() {
        if (!currentButton) return;

        if (currentPopup) {
            currentButton.textContent = 'Ocultar RESUMO';
            currentButton.classList.add('active');
        } else {
            currentButton.textContent = 'Exibir RESUMO';
            currentButton.classList.remove('active');
        }
    }

    // Função para preparar o clone do formulário para PDF
    function prepareFormClone(form) {
        const formClone = form.cloneNode(true);

        const elementsToRemove = [
            'button',
            'input[type="button"]',
            'input[type="submit"]',
            '.button-container',
            '.btn-group',
            '.form-actions'
        ];

        elementsToRemove.forEach(selector => {
            formClone.querySelectorAll(selector).forEach(element => {
                element.parentNode.removeChild(element);
            });
        });

        const allElements = formClone.querySelectorAll('*');
        allElements.forEach(element => {
            const style = window.getComputedStyle(element);
            if (style.borderColor !== 'transparent' && style.borderColor !== 'rgba(0, 0, 0, 0)') {
                element.style.borderColor = 'rgba(0, 0, 0, 0.1)';
            }
        });

        formClone.style.backgroundColor = 'white';
        formClone.style.padding = '10px';
        formClone.style.boxSizing = 'border-box';
        formClone.style.position = 'absolute';
        formClone.style.left = '-9999px';

        return formClone;
    }

    // Função para gerar PDF
    async function generatePDF(data) {
        const form = document.querySelector('form[name="formulario"]');

        if (!form) {
            alert('Formulário não encontrado nesta página.');
            return;
        }

        const loadingMsg = document.createElement('div');
        loadingMsg.textContent = 'Gerando PDF, aguarde...';
        loadingMsg.style.position = 'fixed';
        loadingMsg.style.top = '20px';
        loadingMsg.style.left = '50%';
        loadingMsg.style.transform = 'translateX(-50%)';
        loadingMsg.style.backgroundColor = '#004a8d';
        loadingMsg.style.color = 'white';
        loadingMsg.style.padding = '10px 20px';
        loadingMsg.style.borderRadius = '5px';
        loadingMsg.style.zIndex = '10000';
        document.body.appendChild(loadingMsg);

        try {
            const formClone = prepareFormClone(form);
            document.body.appendChild(formClone);

            const canvas = await html2canvas(formClone, {
                scale: 2,
                logging: false,
                useCORS: true,
                allowTaint: true,
                scrollY: -window.scrollY,
                backgroundColor: '#FFFFFF'
            });
            document.body.removeChild(formClone);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const margin = 5;
            const pageWidth = 210;
            const pageHeight = 297;
            const maxContentHeight = 277;
            const contentWidth = pageWidth - (margin * 2);

            const imgRatio = canvas.width / canvas.height;
            let imgWidth = contentWidth;
            let imgHeight = imgWidth / imgRatio;

            if (imgHeight > maxContentHeight) {
                const splitHeight = Math.floor(canvas.height * (maxContentHeight / imgHeight));

                const canvas1 = document.createElement('canvas');
                canvas1.width = canvas.width;
                canvas1.height = splitHeight;
                const ctx1 = canvas1.getContext('2d');
                ctx1.drawImage(canvas, 0, 0, canvas.width, splitHeight, 0, 0, canvas.width, splitHeight);

                const canvas2 = document.createElement('canvas');
                canvas2.width = canvas.width;
                canvas2.height = canvas.height - splitHeight;
                const ctx2 = canvas2.getContext('2d');
                ctx2.drawImage(canvas, 0, splitHeight, canvas.width, canvas.height - splitHeight,
                              0, 0, canvas.width, canvas.height - splitHeight);

                const imgHeight1 = maxContentHeight;
                const imgHeight2 = (canvas2.height * contentWidth) / canvas2.width;

                pdf.addImage(canvas1, 'PNG', margin, margin, contentWidth, imgHeight1, undefined, 'FAST');
                pdf.addPage();
                pdf.addImage(canvas2, 'PNG', margin, margin, contentWidth, imgHeight2, undefined, 'FAST');
            } else {
                pdf.addImage(canvas, 'PNG', margin, margin, contentWidth, imgHeight, undefined, 'FAST');
            }

            const paciente = data["Nome do Paciente"] || 'formulario';
            const codigo = data["Código da Solicitação:"] || '';
            const fileName = `${paciente}${codigo ? ' (' + codigo + ')' : ''}.pdf`;

            pdf.save(fileName);

        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            alert('Erro ao gerar PDF: ' + error.message);
        } finally {
            if (loadingMsg.parentNode) {
                document.body.removeChild(loadingMsg);
            }
        }
    }

    // Função para criar o pop-up
    function createPopup(data) {
        if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
            updateButton();
            return;
        }

        const popup = document.createElement('div');
        popup.className = 'sisreg-popup-container';

        let content = '<h3>Resumo da Solicitação SISREG</h3><table class="sisreg-popup-table">';

        content += `
            <tr>
                <td>Chave de Confirmação</td>
                <td>${data["Chave de Confirmação:"] || 'Não encontrado'}</td>
            </tr>
            <tr>
                <td>Código da Solicitação</td>
                <td style="color:#2196F3; font-weight:bold;">${data["Código da Solicitação:"] || 'Não encontrado'}</td>
            </tr>
        `;

        const orderedFields = [
            "Nome do Paciente",
            "Profissional Executante:",
            "Data e Horário de Atendimento:",
            "Unidade Executante:",
            "Município:",
            "Procedimentos Solicitados:"
        ];

        orderedFields.forEach(field => {
            if (field === "Unidade Executante:") {
                content += `
                    <tr>
                        <td>${field.replace(':', '')}</td>
                        <td>${data[field] || 'Não encontrado'}</td>
                    </tr>
                    <tr>
                        <td>Endereço</td>
                        <td>
                            ${data["Endereço:"] || ''}${data["Número:"] ? ', ' + data["Número:"] : ''}
                            ${data["Bairro:"] ? ' - ' + data["Bairro:"] : ''}
                            ${data["Complemento:"] ? ', ' + data["Complemento:"] : ''}
                        </td>
                    </tr>
                `;
            } else {
                let value = data[field] || 'Não encontrado';
                if (field === "Procedimentos Solicitados:" && value !== 'Não encontrado') {
                    value = value.replace(/\n/g, '<br>');
                }
                content += `
                    <tr>
                        <td>${field.replace(':', '')}</td>
                        <td>${value}</td>
                    </tr>
                `;
            }
        });

        content += '</table>';

        content += `
            <div style="margin-top:20px;">
                <label style="display:block; margin-bottom:5px; font-weight:bold;">Informar número do WhatsApp:</label>
                <input type="text" id="whatsappInput" class="sisreg-whatsapp-input"
                    placeholder="Exemplo: 11987654321 (DDD + 9 + Celular)"
                    maxlength="11">
                <div id="whatsappError" class="sisreg-error-message">Número inválido! Deve ter 11 dígitos e começar com DDD + 9</div>
            </div>

            <div class="sisreg-popup-buttons-container">
                <button id="sendWhatsAppBtn" class="sisreg-popup-button-action" style="background-color:#25D366;">
                    Enviar mensagem por WhatsApp
                </button>
                <button id="downloadPDFBtn" class="sisreg-popup-button-action" style="background-color:#004a8d;">
                    Baixar PDF
                </button>
                <button id="closePopupBtn" class="sisreg-popup-button-action" style="background-color:#f44336;">
                    Fechar
                </button>
            </div>
        `;

        popup.innerHTML = content;

        const input = popup.querySelector('#whatsappInput');
        const errorDiv = popup.querySelector('#whatsappError');
        const sendBtn = popup.querySelector('#sendWhatsAppBtn');
        const downloadBtn = popup.querySelector('#downloadPDFBtn');
        const closeBtn = popup.querySelector('#closePopupBtn');

        input.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value && !validateWhatsApp(this.value)) {
                errorDiv.style.display = 'block';
                sendBtn.disabled = true;
            } else {
                errorDiv.style.display = 'none';
                sendBtn.disabled = false;
            }
        });

        sendBtn.addEventListener('click', function() {
            if (!input.value || !validateWhatsApp(input.value)) {
                errorDiv.style.display = 'block';
                return;
            }

            whatsapp = input.value.replace(/\D/g, '');
            const message = formatWhatsAppMessage(data);
            const whatsappUrl = `https://web.whatsapp.com/send?phone=55${whatsapp}&text=${encodeURIComponent(message)}`;

            if (typeof GM_openInTab !== 'undefined') {
                GM_openInTab(whatsappUrl, { active: true });
            } else {
                window.open(whatsappUrl, '_blank');
            }
        });

        downloadBtn.addEventListener('click', function() {
            generatePDF(data);
        });

        closeBtn.addEventListener('click', function() {
            popup.remove();
            currentPopup = null;
            updateButton();
        });

        setTimeout(() => {
            input.focus();
        }, 50);

        document.body.appendChild(popup);
        currentPopup = popup;
        updateButton();
    }

    // Função para encontrar o valor abaixo na MESMA COLUNA
    function findValueBelowInSameColumn(cell) {
        const row = cell.parentElement;
        const cellIndex = Array.from(row.cells).indexOf(cell);
        const nextRow = row.nextElementSibling;

        if (nextRow && nextRow.cells.length > cellIndex) {
            return nextRow.cells[cellIndex].textContent.trim();
        }
        return null;
    }

    // Função para verificar se a chave de confirmação existe
    function checkConfirmationKey() {
        const tables = document.getElementsByTagName('table');

        for (let table of tables) {
            const rows = table.rows;

            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].cells;

                for (let j = 0; j < cells.length; j++) {
                    if (cells[j].textContent.trim() === "Chave de Confirmação:") {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Função para encontrar todos os campos solicitados
    function findFields() {
        const fieldsMapping = {
            "Chave de Confirmação:": { special: false },
            "Código da Solicitação:": { special: false },
            "Nome do Paciente": { special: true, handler: findNomePaciente },
            "Profissional Executante:": { special: false },
            "Data e Horário de Atendimento:": { special: true, handler: findDateTime },
            "Unidade Executante:": { special: true, handler: findUnidadeExecutante },
            "Endereço:": { special: false },
            "Número:": { special: false },
            "Complemento:": { special: false },
            "Bairro:": { special: false },
            "Município:": { special: false },
            "Procedimentos Solicitados:": { special: true, handler: findProcedures }
        };

        const result = {};

        for (const [field, config] of Object.entries(fieldsMapping)) {
            if (config.special) {
                result[field] = config.handler();
            } else {
                result[field] = null;
                const tables = document.getElementsByTagName('table');

                tableLoop:
                for (let table of tables) {
                    const rows = table.rows;

                    for (let i = 0; i < rows.length; i++) {
                        const cells = rows[i].cells;

                        for (let j = 0; j < cells.length; j++) {
                            const cellText = cells[j].textContent.trim();
                            if (field === "Município:" && (cellText === "Município:" || cellText === "Municipio:")) {
                                const value = findValueBelowInSameColumn(cells[j]);
                                if (value) {
                                    result[field] = value;
                                    break tableLoop;
                                }
                            }
                            else if (cellText === field) {
                                const value = findValueBelowInSameColumn(cells[j]);
                                if (value) {
                                    result[field] = value;
                                    break tableLoop;
                                }
                            }
                        }
                    }
                }
            }
        }

        return result;
    }

    // Função para adicionar o botão
    function addButton() {
        if (!checkConfirmationKey()) {
            return;
        }

        // Remove o botão existente se houver
        if (currentButton) {
            currentButton.remove();
        }

        const btn = document.createElement('button');
        btn.className = 'sisreg-popup-button';
        btn.textContent = 'Exibir RESUMO';

        btn.onclick = function() {
            if (currentPopup) {
                currentPopup.remove();
                currentPopup = null;
            } else {
                const data = findFields();
                createPopup(data);
            }
            updateButton();
        };

        document.body.appendChild(btn);
        currentButton = btn;
    }

    // Função para verificar se a página está pronta
    function checkPageReady() {
        // Verifica se o DOM está completamente carregado
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            // Adiciona um pequeno atraso para garantir que todos os elementos estejam carregados
            setTimeout(addButton, 1000);
        } else {
            // Se não estiver pronto, espera pelo evento DOMContentLoaded
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(addButton, 1000);
            });
        }
    }

    // Inicia o script
    checkPageReady();

    // Observa mudanças no DOM como fallback
    const observer = new MutationObserver(function(mutations) {
        // Verifica se o botão já foi adicionado
        if (!currentButton) {
            addButton();
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });

    // Adiciona também um listener para mudanças de rota em SPAs
    window.addEventListener('popstate', function() {
        setTimeout(addButton, 1000);
    });
})();
