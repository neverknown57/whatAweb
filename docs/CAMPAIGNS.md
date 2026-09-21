# Broadcast Campaigns & Queue Processing

## 1. Campaign Pipeline
1. **Define Campaign**: Set Campaign Name & Approved Meta Template.
2. **Dynamic Parameter Binding**: Map template placeholders (`{{1}}`) to static text, system variables (`{{current_date}}`), or contact fields (`{{contact.name}}`).
3. **Audience Filter**: Target All Opted-In Contacts or filter by Tag. (Contacts with `opt_in_status = 'opted_out'` are automatically suppressed).
4. **Execution Worker**: Asynchronous background worker processes recipients with rate limiting (50ms delay per send = ~20 msgs/sec) to avoid Meta API rate limit throttles.
5. **Real-time Lifecycle Controls**: Pause, Resume, or Cancel running campaigns.
