pipeline{
  agent any
  stages{
    stage('Checkout'){
      steps {
        git branch: 'main', url: 'https://github.com/gokulseshiah1083/Askmehow'
      }
    }
    stage('Build'){
      steps {
        bat 'echo "building the app"'
      }
    }
    stage('Test'){
      steps {
        bat 'echo "Running the Test"'
      }
    }
    stage('Deploy'){
      steps {
        bat 'echo "Deploying "'
      }
    }
  }
  post {
    success {
      bat 'echo "Build Successful"'
    }
    failure {
      bat 'echo "Build Failed"'
    }
}
}
