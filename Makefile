install:
	npm install

start:
	npx babel-node src/bin/parseng.js

check:
	npx babel-node src/bin/check.js

build:
	rm -rf dist
	npm run build

publish:
	npm publish --dry-run

test:
	npm test

lint:
	npx eslint .

.PHONY: test