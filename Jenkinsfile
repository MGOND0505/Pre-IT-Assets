pipeline {
    agent any

    stages {
        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube-Server') {
                        sh "${scannerHome}/bin/sonar-scanner"
                    }
                }
            }
        }

        stage('Deploy to Live Server') {
            steps {
                sshPublisher(publishers: [
                    sshPublisherDesc(
                        configName: 'Live-Server',
                        transfers: [
                            sshTransfer(
                                cleanRemote: false,
                                excludes: '',
                                execCommand: '''
                                    echo "Deploying to live server..."
                                ''',
                                execTimeout: 120000,
                                flatten: false,
                                makeEmptyDirs: false,
                                noExec: false,
                                remoteDirectory: '/home/ubuntu',
                                removePrefix: '',
                                sourceFiles: '**/*'
                            )
                        ],
                        usePromotionTimestamp: false,
                        useWorkspaceInPromotion: false,
                        verbose: true
                    )
                ])
            }
        }
    }
}
