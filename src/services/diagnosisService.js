import { apiFetch, ApiError } from './apiClient.js'

function normalize(text) {
  return (text || '').toLowerCase().trim()
}

function hasAny(text, terms) {
  return terms.some((t) => text.includes(t))
}

async function tryDiagnoseFromApi(rawProblem) {
  const data = await apiFetch('/api/diagnose', {
    method: 'POST',
    body: {
      problem: rawProblem,
    },
  })

  if (!data || typeof data !== 'object') {
    throw new ApiError('Invalid diagnose response shape', { status: 0, body: data })
  }

  if (typeof data.summary === 'string' && Array.isArray(data.remedies)) {
    return data
  }

  if (typeof data.result === 'object' && data.result) {
    return data.result
  }

  throw new ApiError('Invalid diagnose response fields', { status: 0, body: data })
}

function diagnoseProblemLocal(rawProblem) {
  const problem = normalize(rawProblem)

  if (!problem) {
    return {
      summary: 'No problem description provided.',
      likelyCauses: ['Missing details to diagnose.'],
      remedies: ['Describe what you are seeing (error text, step, logs, and environment).'],
      questions: ['What is the exact error message?', 'Which step fails (build, deploy, verify, runtime)?'],
    }
  }

  if (hasAny(problem, ['health check', 'healthcheck', 'unhealthy', 'readiness', 'liveness'])) {
    return {
      summary: 'Health checks are failing during verification.',
      likelyCauses: [
        'Application process is not listening on the expected port.',
        'Startup time is longer than health-check timeout.',
        'Route used by health check returns non-200 status.',
        'Dependency (DB/cache) is unavailable from the server network.',
      ],
      remedies: [
        'Verify the service listens on the configured port and interface (0.0.0.0).',
        'Increase readiness initial delay / timeout during rollout.',
        'Confirm the health endpoint path and expected response code.',
        'Check outbound connectivity and credentials for required dependencies.',
      ],
      questions: [
        'Which endpoint is used for the health check?',
        'What are the timeout/interval values?',
        'Does the app start successfully when run locally with the same config?',
      ],
    }
  }

  if (hasAny(problem, ['permission', 'access denied', 'unauthorized', 'forbidden', 'iam', 'rbac'])) {
    return {
      summary: 'A permission/authentication issue is preventing a step from completing.',
      likelyCauses: [
        'Deployment identity lacks required role/policy.',
        'Token/secret is missing or expired.',
        'Registry permissions prevent pulling/pushing images.',
      ],
      remedies: [
        'Validate the deployment identity/role has required permissions for the target environment.',
        'Rotate/update the secret or token used by CI/CD.',
        'Verify registry login and image repository permissions.',
      ],
      questions: ['What exact permission error appears in logs?', 'Which environment/cluster is targeted?'],
    }
  }

  if (hasAny(problem, ['timeout', 'timed out', 'connection refused', 'dns', 'resolve', 'network'])) {
    return {
      summary: 'A network/connectivity issue is likely affecting the deployment or runtime.',
      likelyCauses: [
        'Firewall/security group blocks required traffic.',
        'DNS resolution issue for internal/external dependency.',
        'Service endpoint is incorrect or not reachable from servers.',
      ],
      remedies: [
        'Check firewall/security-group rules between services.',
        'Validate DNS records and resolver configuration.',
        'Confirm the correct host/port and that the dependency is healthy.',
      ],
      questions: ['Which hostname/IP is failing?', 'Is the failure only in production or also in staging?'],
    }
  }

  if (hasAny(problem, ['build', 'compile', 'failed to build', 'module not found', 'dependency'])) {
    return {
      summary: 'A build/dependency issue is likely causing failures before deployment.',
      likelyCauses: [
        'Missing dependency or incorrect version pin.',
        'Environment mismatch (Node version, OS, architecture).',
        'Build cache contains stale artifacts.',
      ],
      remedies: [
        'Clean install dependencies and rerun build (lockfile consistent).',
        'Align build runtime versions with local development versions.',
        'Clear build cache and re-run the pipeline.',
      ],
      questions: ['What is the first error line in the build log?', 'Which Node/runtime version is the CI using?'],
    }
  }

  return {
    summary: 'General deployment/runtime issue detected (needs more specifics).',
    likelyCauses: [
      'Configuration mismatch between environments.',
      'A downstream dependency is unhealthy.',
      'An unhandled runtime error occurs after rollout.',
    ],
    remedies: [
      'Provide logs around the failure time and the failing step.',
      'Compare environment variables/config between working and failing environments.',
      'Add/verify monitoring for error rates, latency, and dependency health.',
    ],
    questions: ['What changed since the last successful deploy?', 'What is the deploy mode (single/multi server)?'],
  }
}

export async function diagnoseProblem(rawProblem) {
  try {
    return await tryDiagnoseFromApi(rawProblem)
  } catch (e) {
    if (e instanceof TypeError || e instanceof ApiError) {
      return diagnoseProblemLocal(rawProblem)
    }
    throw e
  }
}
