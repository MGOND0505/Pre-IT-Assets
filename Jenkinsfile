pipeline {
    agent any

    stages {
        stage('Gitleaks Secret Scan') {
            steps {
                sh '''
                    gitleaks detect --source=. --no-git --verbose --exit-code 0
                '''
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube-Server') {
                        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                            sh "${scannerHome}/bin/sonar-scanner -Dsonar.token=${SONAR_TOKEN}"
                        }
                    }
                }
            }
        }

        stage('Trivy Security Scan') {
            steps {
                sh '''
                    trivy fs --exit-code 0 --severity HIGH,CRITICAL --format template --template "@/var/jenkins_home/html.tpl" -o trivy-report.html .
                '''
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'trivy-report.html',
                    reportName: 'Trivy Security Report'
                ])
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

        stage('OWASP ZAP DAST Scan') {
            steps {
                sh '''
                    docker run -u 0 --rm --net=host \
                      -v ${WORKSPACE}:/zap/wrk/:rw \
                      zaproxy/zap-stable zap-baseline.py \
                      -t http://192.168.1.35:3000 \
                      -r zap-report.html \
                      -I || true
                '''
                publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'zap-report.html',
                    reportName: 'OWASP ZAP DAST Report'
                ])
            }
        }
    }
}