echo releasing update
npm version patch -m "updating to %s"
npm publish
git push origin master
