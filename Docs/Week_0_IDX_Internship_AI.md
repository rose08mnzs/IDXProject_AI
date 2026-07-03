# WEEK 0 - Environment Setup & Configuration

## Create new directory
```bash
 mkdir idxproject
 cd idxproject
```

## Install Node.js
```bash
 node -v
 npm -v
```

## Install and check python,mysql,git
```bash
 python --version
 mysql --version
 git --version
```

## Additional - Docker for MySQL
```bash
 docker --version
```

## Clone OpenClaw
```bash
 git clone https://github.com/openclaw/openclaw.git
 cd openclaw
```

## Install dependencies
```bash
 npm install
```

## Install Additional dependencies
```bash
 corepack enable
 corepack pnpm install
 corepack pnpm build
```

## Install Ollama (locally)
```bash
 winget install Ollama.Ollama
 ollama pull qwen3:8b
```

## Verify Ollama
```bash
 ollama list
```

## Configure OpenClaw
```bash
 npx openclaw onboard
```

## Configuration used for this project:
- Provider: Ollama
- Model: qwen3:8b
- Channel: ClickClack
- WhatsApp configured after onboarding

## Create Python virtual environment
```bash
 python -m venv venv
 venv\Scripts\activate
 pip install pandas openai mysql-connector-python sqlalchemy scikit-learn numpy
```

## Setup steps for MySQL (Without Docker)
### Create Database
```bash
mysql -u root -p -e "CREATE DATABASE idx_exchange CHARACTER SET utf8mb4;"
```

## Import SQL Files
```bash
mysql -u root -ppassword idx_exchange < "california_sold.sql" 
mysql -u root -ppassword idx_exchange < "rets_property.sql"
```

## Setup steps for MySQL (With Docker)
### Create MYSQL 8 Container
```bash
docker run --name idx-mysql-local -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=idx_exchange -d mysql:8
```

### Start MYSQL Container
```bash
docker start idx-mysql-local
```

### Checking if it's running 
```bash
docker ps
```

### Connect to database
```bash
docker exec -it idx-mysql-local mysql -u root -ppassword
```

### Import SQL Files
```bash
docker exec -i idx-mysql-local mysql -u root -ppassword idx_exchange < "california_sold.sql" 
docker exec -i idx-mysql-local mysql -u root -ppassword idx_exchange < "rets_property.sql"
```

## Check database
```sql
SHOW DATABASES;
```

## Use database
```sql
USE idx_exchange;
```

## Check tables
```sql
SHOW TABLES;
```

## SQL Query to check the count of data in tables 
```sql
SELECT
(SELECT COUNT(*) FROM rets_property) AS active_listings,
(SELECT COUNT(*) FROM california_sold) AS sold_comps;
```

## .env example file 
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=idx_exchange

OLLAMA_BASE_URL=http://0.0.0.0:50000
DEFAULT_MODEL=ollama/qwen3:8b

OPENAI_API_KEY=
EMAIL_USER=
EMAIL_PASSWORD=
```
## Integrate WhatsApp (Run in separate terminals)
### Start OpenClaw
```bash
 npm run dev
```

### Connect to WhatsApp
```bash
 npm run openclaw -- channels login --channel whatsapp
```

### Scan the QR code using:
- WhatsApp -> Settings -> Linked Devices -> Link a Device
- Follow the onboarding prompts to: Enable WhatsApp, Configure your personal phone, Add the WhatsApp channel

### Check status of OpenClaw
```bash
npm run openclaw -- status
```

### Monitor Logs
```bash
 npm run openclaw -- logs --follow
```

## Useful Commands
### Add a new channel
```bash
npm run openclaw -- channels add
```

### Start OpenClaw
```bash
npm run openclaw -- gateway start
```

### Check gateway status of OpenClaw
```bash
npm run openclaw -- gateway status
```



## Deliverable
![alt text](Images/week1.jpeg)