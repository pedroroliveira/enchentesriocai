# Implantação em Ubuntu com Apache, pfSense e Cloudflare

Este projeto executa de forma independente da GoDaddy com Node.js e PostgreSQL. A topologia prevista, semelhante à do PitStop360, é:

```text
Visitante → Cloudflare (HTTPS) → IP público/pfSense (NAT 443) → Apache (HTTPS)
                                                               └→ Node.js 127.0.0.1:3000
                                                                  └→ PostgreSQL local:5432
```

Somente as portas 80 e 443 chegam ao Apache. Não publique as portas 3000 ou 5432 no pfSense.

## 1. Preparar o Ubuntu

Os comandos abaixo funcionam em Ubuntu 22.04 ou 24.04, com acesso `sudo`:

```bash
sudo apt update
sudo apt install -y curl ca-certificates gnupg apache2 postgresql postgresql-client \
  certbot python3-certbot-dns-cloudflare rsync unzip
sudo a2enmod proxy proxy_http headers ssl rewrite remoteip
```

## 2. Instalar o Node.js 24 LTS

O projeto exige Node.js 22.12 ou superior. Para uma instalação global, adequada ao serviço `systemd`, instale o Node.js 24 LTS pelo repositório NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup_24.sh
sudo -E bash /tmp/nodesource_setup_24.sh
sudo apt install -y nodejs
rm /tmp/nodesource_setup_24.sh
node --version
npm --version
command -v node
```

O último comando deve mostrar `/usr/bin/node`, caminho utilizado pelo serviço incluído no pacote.

## 3. Criar usuário e banco PostgreSQL

Escolha uma senha longa e não reutilize a senha da GoDaddy:

```bash
sudo -u postgres psql
```

No prompt do PostgreSQL:

```sql
CREATE ROLE enchentes LOGIN PASSWORD 'SUBSTITUA_POR_UMA_SENHA_FORTE';
CREATE DATABASE enchentes_vale_cai OWNER enchentes ENCODING 'UTF8';
\q
```

## 4. Preparar, testar e compilar a aplicação

Descompacte o pacote, entre na pasta `Enchentes_Vale_do_Ca` e execute:

```bash
npm ci
cp env.example .env
chmod 600 .env
nano .env
```

Configure principalmente `DATABASE_URL` e `SMTP_*`. Para o PostgreSQL na mesma máquina, use `DATABASE_SSL=false`. Se a senha tiver caracteres reservados de URL, codifique-os na `DATABASE_URL`.

Crie as tabelas e carregue os dados recebidos:

```bash
npm run db:migrate
enchentes_db_url="$(node --env-file=.env -e 'process.stdout.write(process.env.DATABASE_URL || "")')"
test -n "$enchentes_db_url"
psql "$enchentes_db_url" -f deploy/postgresql/seed.sql
psql "$enchentes_db_url" \
  -v leituras_csv='deploy/postgresql/data/leituras.csv' \
  -f deploy/postgresql/import-leituras.sql
unset enchentes_db_url
npm run type-check
npm run test -- --run
npm run build
npm prune --omit=dev
```
O seed contém as oito estações, suas cotas, um alerta e cinco ocorrências. O CSV contém 5.644 leituras válidas. Não execute o seed após importar um dump completo da GoDaddy sem revisar o conteúdo.

## 5. Instalar a aplicação e o serviço

Execute a partir da pasta já compilada:

```bash
sudo install -d -o www-data -g www-data /opt/enchentes-vale-do-cai
sudo rsync -a --delete --exclude='.env' --exclude='.npm-cache' ./ /opt/enchentes-vale-do-cai/
sudo chown -R www-data:www-data /opt/enchentes-vale-do-cai
sudo install -m 600 -o root -g root .env /etc/enchentes-vale-do-cai.env
sudo install -m 644 deploy/systemd/enchentes-vale-do-cai.service \
  /etc/systemd/system/enchentes-vale-do-cai.service
sudo systemctl daemon-reload
sudo systemctl enable --now enchentes-vale-do-cai
```

Valide pela interface local antes de configurar Apache, pfSense ou DNS:

```bash
curl -f http://127.0.0.1:3000/api/health
curl -f http://127.0.0.1:3000/api/estacoes
sudo systemctl status enchentes-vale-do-cai --no-pager
sudo journalctl -u enchentes-vale-do-cai -n 100 --no-pager
```

## 6. Preservar o IP real enviado pela Cloudflare

O pfSense normalmente preserva o IP de origem no port forward. No Apache, aceite `CF-Connecting-IP` somente quando a conexão vier de uma rede oficial da Cloudflare:

```bash
cf_remoteip_tmp="$(mktemp)"
{
  echo 'RemoteIPHeader CF-Connecting-IP'
  curl -fsSL https://www.cloudflare.com/ips-v4 | sed 's/^/RemoteIPTrustedProxy /'
  curl -fsSL https://www.cloudflare.com/ips-v6 | sed 's/^/RemoteIPTrustedProxy /'
} > "$cf_remoteip_tmp"
sudo install -m 644 "$cf_remoteip_tmp" /etc/apache2/conf-available/cloudflare-remoteip.conf
rm "$cf_remoteip_tmp"
sudo a2enconf cloudflare-remoteip
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Repita essa atualização se a Cloudflare alterar suas faixas de IP. O Node aceita cabeçalhos de proxy somente do Apache local (`127.0.0.1`).

## 7. Emitir o certificado sem interromper o site atual

Como o DNS está na Cloudflare, use o desafio DNS. Assim o certificado pode ser emitido antes de trocar o registro `A`.

Na Cloudflare, crie um API Token restrito à zona `enchentesvaledocai.com.br`, com a permissão `Zone / DNS / Edit`. Não use a Global API Key.

No Ubuntu:

```bash
sudo install -d -m 700 /root/.secrets/certbot
sudo nano /root/.secrets/certbot/cloudflare.ini
```

Conteúdo do arquivo:

```ini
dns_cloudflare_api_token = COLE_AQUI_O_TOKEN_RESTRITO
```

Proteja o token e emita o certificado:

```bash
sudo chmod 600 /root/.secrets/certbot/cloudflare.ini
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/certbot/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d enchentesvaledocai.com.br \
  -d www.enchentesvaledocai.com.br
sudo certbot renew --dry-run
```

## 8. Instalar o VirtualHost do Apache

Com o certificado já emitido:

```bash
sudo install -m 644 deploy/apache/enchentesvaledocai.conf \
  /etc/apache2/sites-available/enchentesvaledocai.conf
sudo a2ensite enchentesvaledocai.conf
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Se ainda não tiver certificado e quiser testar somente em HTTP, use temporariamente `deploy/apache/enchentesvaledocai-bootstrap.conf`.

O Apache pode hospedar PitStop360 e Enchentes Vale do Caí simultaneamente. Cada site precisa de um `ServerName` próprio; o cabeçalho Host/SNI seleciona o VirtualHost correto.

## 9. Configurar o pfSense

### Quando os dois sites usam o mesmo Apache

Se o encaminhamento WAN 80/443 do PitStop360 já aponta para este mesmo Ubuntu/Apache, não crie um segundo port forward. Basta instalar o novo VirtualHost. O Apache separará os sites pelo domínio.

### Quando os sites estão em servidores internos diferentes

Um mesmo IP público e uma mesma porta 443 não podem ser encaminhados diretamente para dois servidores por regras NAT comuns. Nesse caso, mantenha um único destino como reverse proxy ou configure HAProxy no pfSense para rotear por SNI/hostname.

### Regras recomendadas

No pfSense:

1. Reserve um IP fixo para o Ubuntu na LAN.
2. Em **Firewall → Aliases**, crie um alias do tipo URL Table para `https://www.cloudflare.com/ips-v4`.
3. Encaminhe TCP 80 e 443 do endereço WAN para o IP interno do Apache.
4. Restrinja a origem da regra às redes do alias Cloudflare. Mantenha acesso administrativo separado pela LAN ou VPN.
5. Não crie encaminhamentos para 3000, 5432 ou SSH público.

Se o IPv6 não estiver configurado até o Ubuntu, não publique um registro `AAAA` de origem. Para IPv6, crie também o alias com `https://www.cloudflare.com/ips-v6` e regras específicas; normalmente não há NAT IPv6.

## 10. Configurar a Cloudflare

Em **DNS**:

- registro `A` de `@`: IP público do pfSense, com proxy ativado (nuvem laranja);
- `www`: CNAME para `enchentesvaledocai.com.br`, também com proxy ativado;
- mantenha MX, SPF, DKIM, DMARC e demais TXT existentes;
- não altere os registros do PitStop360.

Em **SSL/TLS → Overview**, selecione **Full (strict)**. Não use o modo Flexible.

Recomendações adicionais:

- habilite **Always Use HTTPS** depois de validar o certificado;
- crie uma Cache Rule com bypass para caminhos iniciados por `/api/`;
- não aplique cache agressivo ao HTML; os assets versionados já possuem cache longo;
- mantenha o registro web com proxy ativado para não expor acesso direto ao origin.

## 11. Testar o caminho completo

Antes da troca de DNS, teste o VirtualHost diretamente na LAN:

```bash
curl -k --resolve enchentesvaledocai.com.br:443:IP_INTERNO_UBUNTU \
  https://enchentesvaledocai.com.br/api/health
```

Depois da troca:

```bash
curl -I https://enchentesvaledocai.com.br/
curl -f https://enchentesvaledocai.com.br/api/health
curl -f https://enchentesvaledocai.com.br/api/estacoes
sudo tail -n 100 /var/log/apache2/enchentesvaledocai-ssl-access.log
sudo journalctl -u enchentes-vale-do-cai -n 100 --no-pager
```

Na Cloudflare, erros `521` normalmente indicam que o Apache não está acessível na porta esperada ou que o pfSense bloqueou alguma faixa da Cloudflare. Erro `526` indica certificado ausente, vencido ou incompatível com Full (strict).

Também confira `/`, `/mapa`, `/alertas`, `/previsao`, `/sobre`, `/contato`, cadastro de alerta, formulário SMTP, logo, imagem principal, favicon, mapa Windy e câmeras.

## 12. Dados e limitações restantes

O banco inicial contém:

- oito estações e respectivas cotas;
- um alerta ativo;
- cinco ocorrências históricas;
- 5.644 leituras, sem duplicidades.

Ainda falta a tabela privada `notificacoes`, com e-mails e números de WhatsApp. Transfira-a por canal seguro e trate-a conforme a LGPD.

O projeto original cadastra interessados, mas não possui um processo que detecte mudanças de cota e envie alertas. Para notificações reais será necessário acrescentar um worker agendado e configurar provedores de e-mail e WhatsApp.

Mantenha a assinatura GoDaddy ativa durante a validação e por alguns dias após a troca do DNS.
