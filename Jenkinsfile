pipeline {
    agent any

    tools {
        nodejs 'Node24'
    }

    options {
        timestamps()
        skipDefaultCheckout(true)
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        CONTAINER_NAME = 'autovyn-support-backend'
        IMAGE_TAG      = "${BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'production',
                    credentialsId: 'github-creds',
                    url: 'https://github.com/autovyn-orgn/autovyn-support-backend.git'
            }
        }

        stage('Load Env') {
            steps {
                configFileProvider([
                    configFile(fileId: '97c14f03-2576-4bad-896e-eb8b4793df02', variable: 'ENV_FILE')
                ]) {
                    sh 'cp "$ENV_FILE" .env'
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    echo "Installing dependencies..."
                    node -v
                    npm -v
                    npm ci --prefer-offline --no-audit --no-fund
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    echo "Building Docker image..."

                    docker build \
                        --no-cache \
                        -t ${CONTAINER_NAME}:latest \
                        -t ${CONTAINER_NAME}:${IMAGE_TAG} \
                        .
                '''
            }
        }

        stage('Deploy Container') {
            steps {
                sh '''
                    echo "Deploying container..."

                    # Stop & remove old container
                    docker stop ${CONTAINER_NAME} 2>/dev/null || true
                    docker rm ${CONTAINER_NAME} 2>/dev/null || true

                    # Run new container
                    docker run -d \
                        --name ${CONTAINER_NAME} \
                        --env-file .env \
                        -p 3020:3000 \
                        --restart unless-stopped \
                        --health-cmd="curl -s http://localhost:3000/health > /dev/null || exit 1" \
                        --health-interval=30s \
                        --health-timeout=5s \
                        --health-retries=5 \
                        ${CONTAINER_NAME}:latest
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    echo "Waiting for container health..."

                    for i in {1..60}; do
                        STATUS=$(docker inspect --format="{{.State.Health.Status}}" ${CONTAINER_NAME} 2>/dev/null || echo "starting")
                        echo "Health: $STATUS"

                        if [ "$STATUS" = "healthy" ]; then
                            echo "Container is healthy ✅"
                            exit 0
                        fi

                        sleep 2
                    done

                    echo "⚠️ Container not healthy yet, but continuing..."
                '''
            }
        }

        stage('Status & Logs') {
            steps {
                sh '''
                    echo "Container status:"
                    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

                    echo "Health:"
                    docker inspect --format="{{.State.Health.Status}}" ${CONTAINER_NAME} || true

                    echo "Recent logs:"
                    docker logs ${CONTAINER_NAME} --tail 20 || true
                '''
            }
        }

        stage('Cleanup Old Images') {
            steps {
                sh '''
                    echo "Cleaning old images..."

                    docker images ${CONTAINER_NAME} --format "{{.Tag}}" \
                        | grep -E "^[0-9]+$" \
                        | sort -nr \
                        | tail -n +4 \
                        | xargs -r -I {} docker rmi ${CONTAINER_NAME}:{} 2>/dev/null || true

                    docker image prune -f || true
                '''
            }
        }
    }

    post {

        success {
            echo "✅ Deployment successful"
        }

        failure {
            echo "❌ Deployment failed - printing logs..."

            sh '''
                docker logs ${CONTAINER_NAME} --tail 50 || true

                docker stop ${CONTAINER_NAME} 2>/dev/null || true
                docker rm ${CONTAINER_NAME} 2>/dev/null || true
            '''
        }

        always {
            echo "🧹 Final cleanup..."

            sh '''
                rm -rf node_modules dist coverage .nyc_output || true
            '''

            cleanWs(deleteDirs: true)
        }
    }
}
