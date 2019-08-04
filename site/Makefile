HASH := `git rev-parse --short HEAD`

SERVICE := svelte-website
PROJECT := svelte-dev

IMAGE := gcr.io/$(PROJECT)/$(SERVICE):$(HASH)

sapper:
	@echo "\n~> updating template & contributors list"
	@npm run update
	@echo "\n~> building Sapper app"
	@npm run sapper


docker:
	@echo "\n~> building docker image"
	@gcloud builds submit -t $(IMAGE)


deploy: sapper docker
	@echo "\n~> deploying $(SERVICE) to Cloud Run servers"
	@gcloud beta run deploy $(SERVICE) --allow-unauthenticated --platform managed --region us-central1 --image $(IMAGE) --memory=512Mi
