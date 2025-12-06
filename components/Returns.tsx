
import React from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Package, Truck, Mail } from 'lucide-react';
import { STORE_NAME } from '../constants';

const Returns: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl animate-fade-in">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-orange-50 rounded-full text-orange-500 mb-4">
            <RefreshCw size={32} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Trocas e Devoluções</h1>
        <p className="text-gray-600">
            Queremos que fique totalmente satisfeito. <br/>
            Saiba como proceder caso precise de trocar ou devolver um artigo.
        </p>
      </div>

      <div className="grid gap-8">
          
          {/* Política de Devolução (14 Dias) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="text-primary" /> Direito de Livre Resolução (14 Dias)
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                  <p>
                      De acordo com a legislação em vigor, dispõe de um prazo de <strong>14 dias seguidos</strong> a contar da data de receção da encomenda para efetuar a devolução do produto, sem necessidade de indicar o motivo.
                  </p>
                  <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg">
                      <h4 className="font-bold text-orange-800 text-sm uppercase mb-2 flex items-center gap-2">
                          <AlertTriangle size={16} /> Condições Obrigatórias:
                      </h4>
                      <ul className="list-disc pl-5 text-sm text-orange-900 space-y-1">
                          <li>O produto deve estar em estado <strong>novo</strong>, sem sinais de uso.</li>
                          <li>A embalagem original deve estar intacta.</li>
                          <li>Deve incluir todos os acessórios, manuais e ofertas.</li>
                          <li>Apresentar a fatura ou comprovativo de compra.</li>
                      </ul>
                  </div>
              </div>
          </div>

          {/* Garantia (3 Anos) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="text-green-600" /> Garantia de Avaria
              </h2>
              <p className="text-gray-600 mb-4">
                  Se o seu equipamento apresentar defeito de fabrico dentro do período de garantia de <strong>3 Anos</strong>:
              </p>
              <ol className="list-decimal pl-5 space-y-3 text-gray-700">
                  <li>Entre em contacto com o nosso suporte descrevendo a avaria.</li>
                  <li>Faremos uma primeira despistagem remota (muitas vezes é apenas configuração).</li>
                  <li>Se o defeito persistir, recolhemos o equipamento para análise técnica.</li>
                  <li>Confirmado o defeito, procedemos à <strong>reparação, troca por novo ou reembolso</strong>.</li>
              </ol>
          </div>

          {/* Como Proceder (Passo a Passo) */}
          <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center">Como Iniciar um Processo</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                      <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 font-bold shadow-sm">1</div>
                      <h4 className="font-bold text-blue-900 mb-2">Contacte-nos</h4>
                      <p className="text-sm text-blue-700">Envie um email para suporte ou mensagem no WhatsApp com o número do pedido.</p>
                  </div>
                  <div className="text-center">
                      <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 font-bold shadow-sm">2</div>
                      <h4 className="font-bold text-blue-900 mb-2">Prepare o Envio</h4>
                      <p className="text-sm text-blue-700">Embale bem o produto na caixa original e proteja-o para o transporte.</p>
                  </div>
                  <div className="text-center">
                      <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 font-bold shadow-sm">3</div>
                      <h4 className="font-bold text-blue-900 mb-2">Resolução</h4>
                      <p className="text-sm text-blue-700">Após receção e verificação, processamos a troca ou reembolso em até 5 dias.</p>
                  </div>
              </div>
          </div>

          <div className="text-center pt-8 border-t border-gray-100">
              <p className="text-gray-500 text-sm">
                  Dúvidas? Envie um email para <strong className="text-gray-700">suporte@allshop.com</strong>
              </p>
          </div>
      </div>
    </div>
  );
};

export default Returns;
