# Dumpmail

Dumpmail is an open-source email automation platform designed to run entirely on free cron job services, such as GitHub Actions or GitLab CI/CD. The platform offers direct flexibility in where and how data is managed, ensuring total control over your campaign details.

## Deployment Options

### Hosted Dashboard
You can use the platform at [dumpmail.vercel.app](https://dumpmail.vercel.app). When using the hosted version, you can:
- **Choose your database**: Store leads, templates, and logs on Dumpmail's database or connect your own database.
- **Control data privacy**: Mark your data as private, or configure it globally/publicly.

### Self-Hosted Dashboard
If you want to run your own server to interface with the `dumpmail-fork` script:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Anas-github-acc/dumpmail-www.git
   cd dumpmail-www
   ```

2. **Configure environment variables**:
   Copy the example environment configuration file and update the variables with your own credentials (e.g., Supabase project credentials and GitHub credentials):
   ```bash
   cp .env.example .env.local
   ```

3. **Install dependencies**:
   ```bash
   pnpm install
   ```

4. **Run the development server**:
   ```bash
   pnpm dev
   ```

## Features

- **Free cron automation**: Run outreach sequences using native free runners like GitHub Actions or GitLab CI/CD to handle execution schedules.
- **Flexible database hosting**: Use the built-in database with customizable privacy rules or link your own external database.
- **Granular privacy**: Toggle campaign data, template libraries, and lead lists between private storage and shared global pools.
- **Decentralized execution**: Interacts with the `dumpmail-fork` execution engine directly inside your personal repository.

## License

This project is licensed under the MIT License.
