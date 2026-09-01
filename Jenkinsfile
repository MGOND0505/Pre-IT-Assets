// IT Asset & License Management System - CI pipeline.
//
// Scope: build + type-check only. Checks out the repo, installs each app's dependencies, and
// runs `tsc --noEmit` for both backend and frontend so a broken build is caught on every push -
// no Docker build, no deployment. See docker-compose.yml at the repo root for the separate
// deploy path, which this pipeline deliberately does not run.
//
// Prerequisites in Jenkins (Manage Jenkins > Tools > NodeJS installations):
//   - An installation named "Node20" (or change NODE_TOOL_NAME below to match whatever you name
//     it). Requires the NodeJS plugin. If you'd rather use a Node already on the agent's PATH
//     instead of the plugin, delete the `tools { nodejs ... }` block below - every `sh`/`bat`
//     step already only calls `npm`/`npx`, so it works either way.

def NODE_TOOL_NAME = 'Node20'

pipeline {
    agent any

    tools {
        nodejs NODE_TOOL_NAME
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    // Polls every 5 minutes so this works with zero webhook setup. Once Jenkins can reach the
    // git host, replace this with a push-triggered webhook (e.g. `triggers { githubPush() }` if
    // the GitHub plugin is installed) for instant builds instead of a poll delay.
    triggers {
        pollSCM('H/5 * * * *')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Type-check') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                            sh 'npx tsc --noEmit'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                            sh 'npx tsc --noEmit'
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Backend and frontend both type-check cleanly.'
        }
        failure {
            echo 'Build failed - see the stage logs above for which side (backend/frontend) broke.'
        }
    }
}
