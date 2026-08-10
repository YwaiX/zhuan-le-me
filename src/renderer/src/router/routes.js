export const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/convert/office',
    name: 'office-convert',
    component: () => import('../views/convert/OfficeConvert.vue'),
    meta: { title: '文件转换' }
  },
  {
    path: '/convert/image',
    name: 'image-convert',
    component: () => import('../views/convert/ImageConvert.vue'),
    meta: { title: '图片转换' }
  },
  {
    path: '/convert/pdf',
    name: 'pdf-convert',
    component: () => import('../views/convert/PdfConvert.vue'),
    meta: { title: 'PDF转换' }
  },
  {
    path: '/json/format',
    name: 'json-format',
    component: () => import('../views/json/JsonFormat.vue'),
    meta: { title: 'JSON格式化' }
  },
  {
    path: '/json/diff',
    name: 'json-diff',
    component: () => import('../views/json/JsonDiff.vue'),
    meta: { title: '代码对比' }
  },
  {
    path: '/crypto/base64',
    name: 'crypto-base64',
    component: () => import('../views/crypto/Base64.vue'),
    meta: { title: 'Base64加解密' }
  },
  {
    path: '/crypto/md5',
    name: 'crypto-md5',
    component: () => import('../views/crypto/Md5.vue'),
    meta: { title: 'MD5加密' }
  },
  {
    path: '/crypto/keypair',
    name: 'crypto-keypair',
    component: () => import('../views/crypto/KeyPairGenerate.vue'),
    meta: { title: '公钥私钥生成' }
  },
  {
    path: '/crypto/keygen',
    name: 'crypto-keygen',
    component: () => import('../views/crypto/KeyGenerate.vue'),
    meta: { title: '密钥生成' }
  },
  {
    path: '/crypto/jwt',
    name: 'crypto-jwt',
    component: () => import('../views/crypto/JwtTool.vue'),
    meta: { title: 'JWT工具' }
  },
  {
    path: '/format/java',
    name: 'format-java',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'Java格式化', lang: 'java' }
  },
  {
    path: '/format/javascript',
    name: 'format-javascript',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'JavaScript格式化', lang: 'javascript' }
  },
  {
    path: '/format/typescript',
    name: 'format-typescript',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'TypeScript格式化', lang: 'typescript' }
  },
  {
    path: '/format/yaml',
    name: 'format-yaml',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'YAML格式化', lang: 'yaml' }
  },
  {
    path: '/format/properties',
    name: 'format-properties',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'Properties格式化', lang: 'properties' }
  },
  {
    path: '/format/sql',
    name: 'format-sql',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'SQL格式化', lang: 'sql' }
  },
  {
    path: '/format/xml',
    name: 'format-xml',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'XML格式化', lang: 'xml' }
  },
  {
    path: '/format/dockerfile',
    name: 'format-dockerfile',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'Dockerfile格式化', lang: 'dockerfile' }
  },
  {
    path: '/format/nginx',
    name: 'format-nginx',
    component: () => import('../views/format/CodeFormat.vue'),
    meta: { title: 'Nginx格式化', lang: 'nginx' }
  }
]
