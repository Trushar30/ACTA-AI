/**
 * Task Extraction Service
 * Extracts actionable tasks from meeting transcripts using OpenAI
 */

const axios = require('axios');

/**
 * Extract tasks from transcript using OpenAI API
 * @param {string} transcript - The meeting transcript
 * @returns {Promise<Array>} Array of extracted tasks
 */
async function extractTasksFromTranscript(transcript) {
    if (!transcript || typeof transcript !== 'string') {
        return [];
    }

    try {
        console.log('[Task Extraction] Starting OpenAI task extraction...');
        console.log('[Task Extraction] Transcript length:', transcript.length, 'characters');

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            console.error('[Task Extraction] OpenAI API key not found');
            return fallbackExtraction(transcript);
        }

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert meeting assistant that extracts actionable tasks from meeting transcripts.

Extract ALL types of tasks including:
- Action items and follow-ups
- Assignments and responsibilities
- Deadlines and due dates
- Decisions to be implemented
- Research or investigation tasks
- Documentation needs
- Approvals needed
- Meetings to schedule
- Reviews or feedback required
- Updates or communications to send

For each task, identify:
1. The task description (clear and actionable)
2. Who is responsible (if mentioned)
3. Deadline or timeframe (if mentioned)
4. Priority level (high/medium/low based on context)

Return ONLY a valid JSON array of tasks. Each task should have this structure:
{
  "task": "Clear description of what needs to be done",
  "assignee": "Person's name or 'Unassigned'",
  "deadline": "Specific date or timeframe or null",
  "priority": "high/medium/low",
  "category": "action-item/decision/research/communication/meeting/review/documentation/approval"
}

Be thorough and extract as many actionable items as possible.`
                    },
                    {
                        role: 'user',
                        content: `Extract all actionable tasks from this meeting transcript:\n\n${transcript}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            },
            {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const content = response.data.choices[0].message.content.trim();
        console.log('[Task Extraction] OpenAI response:', content.substring(0, 200) + '...');

        // Parse JSON response
        let tasks = [];
        try {
            // Remove markdown code blocks if present
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
            const jsonString = jsonMatch ? jsonMatch[1] : content;
            tasks = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('[Task Extraction] Failed to parse OpenAI response:', parseError.message);
            // Try to extract JSON array from the response
            const arrayMatch = content.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                tasks = JSON.parse(arrayMatch[0]);
            }
        }

        if (!Array.isArray(tasks)) {
            console.error('[Task Extraction] OpenAI response is not an array');
            return fallbackExtraction(transcript);
        }

        console.log(`[Task Extraction] Successfully extracted ${tasks.length} tasks`);
        
        // Add flags for integration status
        tasks = tasks.map(task => ({
            ...task,
            addedToJira: false,
            addedToTrello: false
        }));

        return tasks;

    } catch (error) {
        console.error('[Task Extraction] OpenAI API error:', error.message);
        if (error.response) {
            console.error('[Task Extraction] Response status:', error.response.status);
            console.error('[Task Extraction] Response data:', error.response.data);
        }
        
        // Fallback to regex-based extraction
        console.log('[Task Extraction] Falling back to regex extraction...');
        return fallbackExtraction(transcript);
    }
}

/**
 * Fallback extraction using regex patterns
 */
function fallbackExtraction(transcript) {
    const tasks = [];
    const lines = transcript.split('\n');

    // Simple regex patterns to detect tasks
    const taskPatterns = [
        /(?:will|should|need to|must|going to|has to)\s+(.+?)(?:\.|$)/gi,
        /(?:action item|todo|task):\s*(.+?)(?:\.|$)/gi,
        /(?:assign|assigned to)\s+(\w+)\s+(?:to|for|will)\s+(.+?)(?:\.|$)/gi,
        /(?:follow up|follow-up)\s+(?:on|with)?\s*(.+?)(?:\.|$)/gi,
        /(?:let's|we should|we need to)\s+(.+?)(?:\.|$)/gi
    ];

    const assigneePattern = /(?:assign|assigned to|@)(\w+)/i;
    const deadlinePattern = /(?:by|due|deadline|before)\s+([A-Za-z]+\s+\d{1,2}|tomorrow|next week|end of week|\d{1,2}\/\d{1,2})/i;

    for (const line of lines) {
        for (const pattern of taskPatterns) {
            const matches = [...line.matchAll(pattern)];
            
            for (const match of matches) {
                const taskText = match[1] || match[0];
                if (taskText && taskText.length > 10 && taskText.length < 200) {
                    const assigneeMatch = line.match(assigneePattern);
                    const deadlineMatch = line.match(deadlinePattern);

                    tasks.push({
                        task: taskText.trim(),
                        assignee: assigneeMatch ? assigneeMatch[1] : 'Unassigned',
                        deadline: deadlineMatch ? deadlineMatch[1] : null,
                        priority: 'medium',
                        category: 'action-item',
                        addedToJira: false,
                        addedToTrello: false
                    });
                }
            }
        }
    }

    // Remove duplicates
    const uniqueTasks = tasks.filter((task, index, self) =>
        index === self.findIndex(t => t.task === task.task)
    );

    return uniqueTasks;
}

module.exports = {
    extractTasksFromTranscript
};
