npm ci
npm run type-check
npm run build

sudo rsync -a --delete dist/ /opt/enchentes-vale-do-cai/dist/
sudo chown -R www-data:www-data /opt/enchentes-vale-do-cai/dist
sudo systemctl restart enchentes-vale-do-cai
sudo systemctl status enchentes-vale-do-cai --no-pager
