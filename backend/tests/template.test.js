const assert = require('assert');
const TemplateService = require('../services/TemplateService');

function testTemplateParsing() {
  console.log('Running Template Component Analysis Test...');

  const mockTemplate = {
    name: 'order_update',
    language: 'en_US',
    status: 'APPROVED',
    components: [
      { type: 'HEADER', format: 'TEXT', text: 'Order Confirmation' },
      { type: 'BODY', text: 'Hello {{1}}, your order {{2}} is being processed for {{3}}.' },
      { type: 'FOOTER', text: 'Thank you for shopping with us.' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'Track Order', url: 'https://example.com/track/{{1}}' }],
      },
    ],
  };

  const analysis = TemplateService.analyzeTemplate(mockTemplate);

  assert.strictEqual(analysis.bodyParams.length, 3);
  assert.strictEqual(analysis.bodyParams[0].key, 'body_var_1');
  assert.strictEqual(analysis.buttons[0].hasVariable, true);

  console.log('✓ Template Component Analysis Test Passed');
}

function testParameterResolution() {
  console.log('Running Parameter Resolution Test...');

  const contact = {
    name: 'Saurabh',
    wa_number: '919876543210',
    email: 'saurabh@example.com',
    custom_fields: { order_id: 'ORD-9988' },
  };

  const rawVal = 'Hello {{contact.name}}, your order {{contact.order_id}} is ready.';
  const resolved = TemplateService.resolveValue(rawVal, contact);

  assert.strictEqual(resolved, 'Hello Saurabh, your order ORD-9988 is ready.');
  console.log('✓ Parameter Resolution Test Passed');
}

function testDefaultMappingExtraction() {
  console.log('Running Default Mapping Extraction Test...');

  const components = [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Welcome {{1}}',
      example: { header_text: ['Valued Member'] },
    },
    {
      type: 'BODY',
      text: 'Hello {{1}}, your booking {{2}} is confirmed.',
      example: { body_text: [['Alice', 'BK-1029']] },
    },
  ];

  const extracted = TemplateService.extractDefaultMapping(components);

  assert.strictEqual(extracted.header_text, 'Valued Member');
  assert.strictEqual(extracted.body_var_1, 'Alice');
  assert.strictEqual(extracted.body_var_2, 'BK-1029');

  console.log('✓ Default Mapping Extraction Test Passed');
}

function testBuildPayloadComponents() {
  console.log('Running Build Payload Components Test...');

  const components = [
    { type: 'BODY', text: 'Hello {{1}}, welcome back to {{2}}.' },
  ];

  const mapping = {
    body_var_1: '{{contact.name}}',
    body_var_2: 'Our Store',
  };

  const contact = { name: 'Bob', wa_number: '123456789' };

  const payloadComps = TemplateService.buildPayloadComponents(components, mapping, contact);

  assert.strictEqual(payloadComps.length, 1);
  assert.strictEqual(payloadComps[0].type, 'body');
  assert.strictEqual(payloadComps[0].parameters[0].text, 'Bob');
  assert.strictEqual(payloadComps[0].parameters[1].text, 'Our Store');

  console.log('✓ Build Payload Components Test Passed');
}

function runAllTests() {
  try {
    testTemplateParsing();
    testParameterResolution();
    testDefaultMappingExtraction();
    testBuildPayloadComponents();
    console.log('\nAll Automated Unit Tests Completed Successfully!');
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = runAllTests;
